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

# On ne décode en profondeur QUE la carte des personnages (le reste = octets bruts,
# ce qui évite les décodeurs périmés (map objects, etc.) et accélère le parsing).
_CHAR_KEY = ".worldSaveData.CharacterSaveParameterMap.Value.RawData"
CUSTOM = {_CHAR_KEY: PALWORLD_CUSTOM_PROPERTIES[_CHAR_KEY]}


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


def extract(level_path, player_paths):
    # --- Saves joueurs : party + palbox par joueur ---
    players_by_uid = {}
    for pf in player_paths:
        try:
            pl = read_gvas(pf)
            sd = pl.properties["SaveData"]["value"]
            uid = guid_str(sd.get("PlayerUId"))
            if uid:
                players_by_uid[uid] = {
                    "party": player_container(sd, "OtomoCharacterContainerId"),
                    "palbox": player_container(sd, "PalStorageContainerId"),
                }
        except Exception:
            continue

    lvl = read_gvas(level_path)
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
            players[key_uid] = name if isinstance(name, str) else players.get(key_uid)
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
            "ownerUid": owner,
            "location": location,
        })

    return {
        "meta": {"world": os.path.basename(os.path.dirname(level_path)), "palCount": len(pals)},
        "players": [
            {"uid": uid, "name": players.get(uid) or "Joueur",
             "palCount": sum(1 for p in pals if p["ownerUid"] == uid)}
            for uid in players
        ],
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
