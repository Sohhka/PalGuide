# -*- coding: utf-8 -*-
"""
Extrait les Pals possédés depuis des fichiers GVAS Palworld DÉJÀ DÉCOMPRESSÉS
(la décompression Oodle/PlM est faite côté Node via oozextract).

Usage :
  python import_save.py <level.gvas> [player1.gvas player2.gvas ...]
Sortie : JSON sur stdout { meta, players, pals }
Nécessite : pip install palworld-save-tools
"""
import sys, os, json, io, contextlib

try:
    import palworld_save_tools.rawdata.character as _char
    from palworld_save_tools.gvas import GvasFile
    from palworld_save_tools.paltypes import PALWORLD_CUSTOM_PROPERTIES, PALWORLD_TYPE_HINTS
except Exception:
    sys.stderr.write(
        "MODULE_MISSING: le paquet 'palworld-save-tools' est requis.\n"
        "Installe-le avec : pip install palworld-save-tools\n"
    )
    sys.exit(3)


# --- Rend le décodeur de personnages tolérant au format 1.0 (octets en trop) ---
def _lenient_decode_bytes(parent_reader, char_bytes):
    reader = parent_reader.internal_copy(bytes(char_bytes), debug=False)
    data = {"object": reader.properties_until_end()}
    try:
        data["unknown_bytes"] = reader.byte_list(4)
        data["group_id"] = reader.guid()
    except Exception:
        pass
    return data


_char.decode_bytes = _lenient_decode_bytes


# --- Tolérance du lecteur générique pour les saves 1.0 / multijoueur -----------
# palworld-save-tools 0.24.0 (dernière version PyPI) ne sait pas décoder certaines
# structures présentes dans les grosses saves multijoueur : valeurs de map Int64
# (ex. LevelObjectRecoverPartySaveData.PlayerLastUsedTimes) et SetProperty
# (ex. InLockerCharacterInstanceIDArray). On n'a besoin que de la carte des
# personnages : on lit ces valeurs quand c'est trivial, on saute le reste.
from palworld_save_tools.archive import FArchiveReader

_orig_prop_value = FArchiveReader.prop_value


def _lenient_prop_value(self, type_name, struct_type_name, path):
    # Valeurs de map primitives non gérées par 0.24.0 (lues telles quelles).
    prim = {
        "Int64Property": self.i64,
        "UInt64Property": self.u64,
        "UInt32Property": self.u32,
        "Int16Property": self.i16,
        "UInt16Property": self.u16,
        "FloatProperty": self.float,
        "DoubleProperty": self.double,
        "StrProperty": self.fstring,
    }
    fn = prim.get(type_name)
    if fn is not None:
        return fn()
    return _orig_prop_value(self, type_name, struct_type_name, path)


FArchiveReader.prop_value = _lenient_prop_value

_orig_property = FArchiveReader.property


def _lenient_property(self, type_name, size, path, nested_caller_path=""):
    # SetProperty n'est pas géré par 0.24.0 : on lit l'en-tête (type d'élément +
    # guid optionnel) puis on saute le cœur (size octets). Non nécessaire ici.
    if type_name == "SetProperty":
        self.fstring()          # type d'élément
        self.optional_guid()
        self.skip(size)
        return {"skipped": True, "type": type_name}
    return _orig_property(self, type_name, size, path, nested_caller_path)


FArchiveReader.property = _lenient_property


# Décodeur des camps de base tolérant (le transform est lu avant le check EOF, que
# le format 1.0 fait échouer à cause d'octets en trop — comme pour les persos).
import palworld_save_tools.rawdata.base_camp as _base_camp


def _lenient_base_camp_decode_bytes(parent_reader, b_bytes):
    # Lecture défensive : si une base a un format inattendu, on renvoie ce qu'on a
    # pu lire (le transform si atteint) sans casser tout l'import — le blob a déjà
    # été consommé côté flux, seule son interprétation échoue.
    r = parent_reader.internal_copy(bytes(b_bytes), debug=False)
    data = {}
    try:
        data["id"] = r.guid()
        data["name"] = r.fstring()
        data["state"] = r.byte()
        data["transform"] = r.ftransform()
        data["area_range"] = r.float()
        data["group_id_belong_to"] = r.guid()
        data["fast_travel_local_transform"] = r.ftransform()
        data["owner_map_object_instance_id"] = r.guid()
    except Exception:
        pass
    return data


_base_camp.decode_bytes = _lenient_base_camp_decode_bytes

# On décode en profondeur la carte des personnages + les camps de base (positions).
# Le reste = octets bruts (évite les décodeurs périmés (map objects, etc.) + accélère).
_CHAR_KEY = ".worldSaveData.CharacterSaveParameterMap.Value.RawData"
_BASE_KEY = ".worldSaveData.BaseCampSaveData.Value.RawData"
CUSTOM = {k: PALWORLD_CUSTOM_PROPERTIES[k] for k in (_CHAR_KEY, _BASE_KEY) if k in PALWORLD_CUSTOM_PROPERTIES}


def read_gvas(path):
    with open(path, "rb") as f:
        raw = f.read()
    with contextlib.redirect_stdout(io.StringIO()):  # avale les warnings "Struct type…"
        return GvasFile.read(raw, PALWORLD_TYPE_HINTS, CUSTOM)


def scalar(d):
    """Déballe récursivement les {'value': …} jusqu'à une valeur simple."""
    seen = 0
    while isinstance(d, dict) and "value" in d and seen < 8:
        d = d["value"]
        seen += 1
    return d


def guid_str(v):
    v = scalar(v)
    return str(v).lower() if v is not None else None


def container_guid(slotid):
    try:
        return guid_str(slotid["value"]["ContainerId"]["value"]["ID"])
    except Exception:
        return None


def player_container(sd, key):
    try:
        return guid_str(sd[key]["value"]["ID"])
    except Exception:
        return None


def normalize_species(cid):
    low = cid.lower()
    for pre in ("boss_", "gym_", "raid_", "predator_", "summon_"):
        if low.startswith(pre):
            return cid[len(pre):]
    return cid


def unlocked_flags(record_data, field):
    """GUIDs (minuscule, sans tiret) des drapeaux à True dans record_data[field]."""
    out = []
    try:
        for e in scalar(record_data[field]):
            if scalar(e.get("value")) in (True, 1):
                k = guid_str(e.get("key"))
                if k:
                    out.append(k.replace("-", ""))
    except Exception:
        pass
    return out


def extract_bases(lvl):
    """Positions monde des camps de base (x,y,z) + guilde d'appartenance."""
    bases = []
    try:
        bcs = lvl.properties["worldSaveData"]["value"]["BaseCampSaveData"]["value"]
    except Exception:
        return bases
    for b in bcs:
        try:
            rd = b["value"]["RawData"]["value"]
            t = rd["transform"]["translation"]
            bases.append({
                "x": t["x"], "y": t["y"], "z": t["z"],
                "group": guid_str(rd.get("group_id_belong_to")),
            })
        except Exception:
            continue
    return bases


def status_points(sp):
    """Points de statut du joueur : { nom (japonais) -> points }."""
    out = {}
    try:
        for it in scalar(sp.get("GotStatusPointList", {})).get("values", []):
            nm = it.get("StatusName", {}).get("value")
            pt = it.get("StatusPoint", {}).get("value")
            if isinstance(nm, str) and isinstance(pt, int):
                out[nm] = pt
    except Exception:
        pass
    return out


def extract(level_path, player_paths):
    # --- Saves joueurs : party + palbox + voyage rapide + points de techno par joueur ---
    players_by_uid = {}
    for pf in player_paths:
        try:
            pl = read_gvas(pf)
            sd = pl.properties["SaveData"]["value"]
            uid = guid_str(sd.get("PlayerUId"))
            if uid:
                rec = scalar(sd.get("RecordData")) if "RecordData" in sd else {}
                players_by_uid[uid] = {
                    "party": player_container(sd, "OtomoCharacterContainerId"),
                    "palbox": player_container(sd, "PalStorageContainerId"),
                    "fastTravel": unlocked_flags(rec, "FastTravelPointUnlockFlag"),
                    "techPoint": scalar(sd.get("TechnologyPoint", {})) if "TechnologyPoint" in sd else None,
                    "bossTechPoint": scalar(sd.get("bossTechnologyPoint", {})) if "bossTechnologyPoint" in sd else None,
                }
        except Exception:
            continue

    lvl = read_gvas(level_path)
    bases = extract_bases(lvl)
    chars = lvl.properties["worldSaveData"]["value"]["CharacterSaveParameterMap"]["value"]

    def sp_of(e):
        return e["value"]["RawData"]["value"]["object"]["SaveParameter"]["value"]

    players = {}
    pals = []
    for e in chars:
        try:
            sp = sp_of(e)
        except Exception:
            continue
        is_player = scalar(sp.get("IsPlayer", {})) is True
        key_uid = guid_str(e["key"].get("PlayerUId"))
        if is_player:
            name = scalar(sp.get("NickName", {}))
            lvl_p = scalar(sp.get("Level", {}))
            exp_p = scalar(sp.get("Exp", {}))
            players[key_uid] = {
                "name": name if isinstance(name, str) else (players.get(key_uid) or {}).get("name"),
                "instanceId": guid_str(e["key"].get("InstanceId")),
                "level": lvl_p if isinstance(lvl_p, int) else 1,
                "exp": exp_p if isinstance(exp_p, int) else 0,
                "statusPoints": status_points(sp),
            }
            continue

        cid = scalar(sp.get("CharacterID", {}))
        if not isinstance(cid, str) or not cid:
            continue

        # Propriétaire : OwnerPlayerUId (ancien format) ou dernier OldOwnerPlayerUIds (1.0)
        owner = guid_str(sp.get("OwnerPlayerUId")) if "OwnerPlayerUId" in sp else None
        if not owner and "OldOwnerPlayerUIds" in sp:
            try:
                vals = scalar(sp["OldOwnerPlayerUIds"]).get("values", [])
                if vals:
                    owner = guid_str(vals[-1])
            except Exception:
                pass
        if not owner:
            owner = key_uid

        # Conteneur : "SlotId" (1.0) ou "SlotID" (ancien)
        slot = sp.get("SlotId") or sp.get("SlotID")
        cont = container_guid(slot) if slot else None
        pc = players_by_uid.get(owner) or {}
        location = "party" if cont and cont == pc.get("party") else (
            "palbox" if cont and cont == pc.get("palbox") else "base"
        )

        g = scalar(sp.get("Gender", {}))
        gender = "male" if isinstance(g, str) and g.endswith("Male") else (
            "female" if isinstance(g, str) and g.endswith("Female") else None
        )

        passives = []
        psl = sp.get("PassiveSkillList")
        if psl:
            try:
                passives = list(scalar(psl)["values"])
            except Exception:
                passives = []

        active_skills = []
        ew = sp.get("EquipWaza")
        if ew:
            try:
                active_skills = [str(w).replace("EPalWazaID::", "") for w in scalar(ew)["values"]]
            except Exception:
                active_skills = []

        nick = scalar(sp.get("NickName", {}))
        lvl_v = scalar(sp.get("Level", {}))

        # Rang de condensation -> etoiles (0..4). Champ "Rank" (1..5), souvent absent si 0 etoile.
        rank_v = scalar(sp.get("Rank", {}))
        stars = (rank_v - 1) if isinstance(rank_v, int) else 0
        stars = max(0, min(4, stars))

        pals.append({
            "instanceId": guid_str(e["key"].get("InstanceId")),
            "characterId": cid,
            "species": normalize_species(cid),
            "isBoss": normalize_species(cid) != cid,
            "gender": gender,
            "level": lvl_v if isinstance(lvl_v, int) else 1,
            "stars": stars,
            "nickname": nick if isinstance(nick, str) else None,
            "iv": {
                "hp": scalar(sp.get("Talent_HP", {})) if isinstance(scalar(sp.get("Talent_HP", {})), int) else 0,
                "melee": scalar(sp.get("Talent_Melee", {})) if isinstance(scalar(sp.get("Talent_Melee", {})), int) else 0,
                "shot": scalar(sp.get("Talent_Shot", {})) if isinstance(scalar(sp.get("Talent_Shot", {})), int) else 0,
                "defense": scalar(sp.get("Talent_Defense", {})) if isinstance(scalar(sp.get("Talent_Defense", {})), int) else 0,
            },
            "passives": passives,
            "activeSkills": active_skills,
            "ownerUid": owner,
            "location": location,
        })

    return {
        "meta": {"world": os.path.basename(os.path.dirname(level_path)), "palCount": len(pals)},
        "players": [
            {"uid": uid, "name": pdata.get("name") or "Joueur",
             "palCount": sum(1 for p in pals if p["ownerUid"] == uid),
             "fastTravel": (players_by_uid.get(uid) or {}).get("fastTravel", []),
             "instanceId": pdata.get("instanceId"),
             "level": pdata.get("level"),
             "exp": pdata.get("exp"),
             "statusPoints": pdata.get("statusPoints", {}),
             "techPoint": (players_by_uid.get(uid) or {}).get("techPoint"),
             "bossTechPoint": (players_by_uid.get(uid) or {}).get("bossTechPoint"),
             "palboxId": (players_by_uid.get(uid) or {}).get("palbox")}
            for uid, pdata in players.items()
        ],
        "bases": bases,
        "pals": pals,
    }


def main():
    if len(sys.argv) < 2:
        sys.stderr.write("USAGE: python import_save.py <level.gvas> [players...]\n")
        sys.exit(2)
    out = extract(sys.argv[1], sys.argv[2:])
    # Écrit en UTF-8 brut (indépendant de l'encodage console Windows)
    sys.stdout.buffer.write(json.dumps(out, ensure_ascii=False).encode("utf-8"))


if __name__ == "__main__":
    main()
