#!/usr/bin/env python3
# Échange l'identité (PlayerUId) de deux joueurs dans une save — « fix host save ».
# Sert à jouer en solo une save multijoueur (le GUID solo diffère du GUID multi).
#   python fix_host_save.py <config.json>
# config = { levelIn, levelOut, p1In, p1Out, p2In, p2Out, uid1, uid2 }
# Après : le contenu de p1 porte uid2 et inversement (Node écrit p1Out sous le nom de uid2).
# Sortie JSON : { ok, verified, inst1, inst2, palbox1, palbox2, swapped:{...} }
import sys, os, json, types, uuid
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
sys.modules.setdefault("palooz", types.ModuleType("palooz"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palsav.gvas import GvasFile
from palsav.paltypes import PALWORLD_CUSTOM_PROPERTIES, PALWORLD_TYPE_HINTS

CHAR = ".worldSaveData.CharacterSaveParameterMap.Value.RawData"
GRP = ".worldSaveData.GroupSaveDataMap"
# Clés d'ownership à échanger (scalaire UUID ou {'value': UUID})
OWNER_KEYS = {"OwnerPlayerUId", "owner_player_uid", "build_player_uid", "private_lock_player_uid",
              "LastOwnerPlayerUId", "LastNickNameModifierPlayerUid"}

def load(path, props=None):
    cp = {} if props is None else {k: v for k, v in PALWORLD_CUSTOM_PROPERTIES.items() if k in props}
    return GvasFile.read(open(path, "rb").read(), type_hints=PALWORLD_TYPE_HINTS, custom_properties=cp)

def main():
    cfg = json.load(open(sys.argv[1], encoding="utf-8"))
    u1, u2 = uuid.UUID(cfg["uid1"]), uuid.UUID(cfg["uid2"])
    U1, U2 = str(u1), str(u2)

    # palsav décode les Guid avec sa propre classe UUID (pas uuid.UUID standard) :
    # on détecte par nom de type + on compare/écrit via str (le writer accepte les 2).
    def is_uuid(v):
        return type(v).__name__ == "UUID" or isinstance(v, uuid.UUID)

    def swap(v):
        if is_uuid(v):
            s = str(v).lower()
            if s == U1: return u2
            if s == U2: return u1
        elif isinstance(v, str):  # certains UID sont des chaînes (ex. dans les _dps)
            sl = v.lower()
            if sl == U1: return str(u2)
            if sl == U2: return str(u1)
        return None

    lvl = load(cfg["levelIn"], {CHAR, GRP})
    p1 = load(cfg["p1In"])
    p2 = load(cfg["p2In"])

    def sd(p): return p.properties["SaveData"]["value"]
    def indiv(p): return sd(p)["IndividualId"]["value"]
    inst1 = str(indiv(p1)["InstanceId"]["value"])
    inst2 = str(indiv(p2)["InstanceId"]["value"])
    palbox1 = str(sd(p1).get("PalStorageContainerId", {}).get("value", {}).get("ID", {}).get("value", ""))
    palbox2 = str(sd(p2).get("PalStorageContainerId", {}).get("value", {}).get("ID", {}).get("value", ""))

    # 1) player.sav : échange PlayerUId + IndividualId.PlayerUId (p1 -> u2, p2 -> u1)
    for p, nu in ((p1, u2), (p2, u1)):
        sd(p)["PlayerUId"]["value"] = nu
        indiv(p)["PlayerUId"]["value"] = nu

    wsd = lvl.properties["worldSaveData"]["value"]
    counts = {"cspm_key": 0, "owner": 0, "old_owner": 0, "guild_handle": 0, "guild_admin": 0, "guild_player": 0}

    # 2) CSPM : key.PlayerUId des entrées joueur (par InstanceId)
    for e in wsd["CharacterSaveParameterMap"]["value"]:
        try:
            iid = str(e["key"]["InstanceId"]["value"])
        except Exception:
            continue
        if iid == inst1:
            e["key"]["PlayerUId"]["value"] = u2; counts["cspm_key"] += 1
        elif iid == inst2:
            e["key"]["PlayerUId"]["value"] = u1; counts["cspm_key"] += 1

    # 3) deep-swap ownership (OwnerPlayerUId etc. + OldOwnerPlayerUIds) dans tout worldSaveData
    def walk(o):
        if isinstance(o, dict):
            for k in list(o.keys()):
                v = o[k]
                if k in OWNER_KEYS:
                    if isinstance(v, dict) and "value" in v:
                        s = swap(v["value"])
                        if s is not None: v["value"] = s; counts["owner"] += 1
                    else:
                        s = swap(v)
                        if s is not None: o[k] = s; counts["owner"] += 1
                elif k == "OldOwnerPlayerUIds":
                    try:
                        vals = v["value"]["values"]
                        for i in range(len(vals)):
                            s = swap(vals[i])
                            if s is not None: vals[i] = s; counts["old_owner"] += 1
                    except Exception:
                        pass
                walk(v)
        elif isinstance(o, list):
            for i in o:
                walk(i)
    walk(wsd)

    # 4) guilde : handle_ids.guid, admin_player_uid, players[].player_uid (par valeur)
    for g in wsd.get("GroupSaveDataMap", {}).get("value", []):
        raw = g["value"]["RawData"]["value"]
        for h in raw.get("individual_character_handle_ids", []):
            s = swap(h.get("guid"))
            if s is not None: h["guid"] = s; counts["guild_handle"] += 1
        if "admin_player_uid" in raw:
            s = swap(raw["admin_player_uid"])
            if s is not None: raw["admin_player_uid"] = s; counts["guild_admin"] += 1
        for pl in raw.get("players", []):
            s = swap(pl.get("player_uid"))
            if s is not None: pl["player_uid"] = s; counts["guild_player"] += 1

    # 5) fichiers _dps (optionnels) : échange l'owner uid dans les Pals stockés
    counts["dps"] = 0
    for din, dout in ((cfg.get("dps1In"), cfg.get("dps1Out")), (cfg.get("dps2In"), cfg.get("dps2Out"))):
        if din and dout and os.path.exists(din):
            try:
                d = load(din)
                walk(d.properties)
                open(dout, "wb").write(d.write({}))
                counts["dps"] += 1
            except Exception:
                pass

    # écriture
    open(cfg["levelOut"], "wb").write(lvl.write({k: v for k, v in PALWORLD_CUSTOM_PROPERTIES.items() if k in (CHAR, GRP)}))
    open(cfg["p1Out"], "wb").write(p1.write({}))
    open(cfg["p2Out"], "wb").write(p2.write({}))

    # vérification : relire Level.sav écrit — plus aucune entrée joueur/owner avec l'ancien mapping croisé
    lvl2 = load(cfg["levelOut"], {CHAR, GRP})
    wsd2 = lvl2.properties["worldSaveData"]["value"]
    ok = True
    for e in wsd2["CharacterSaveParameterMap"]["value"]:
        try:
            iid = str(e["key"]["InstanceId"]["value"]); pu = str(e["key"]["PlayerUId"]["value"])
        except Exception:
            continue
        if iid == inst1 and pu != U2: ok = False
        if iid == inst2 and pu != U1: ok = False

    print(json.dumps({
        "ok": True, "verified": ok, "inst1": inst1, "inst2": inst2,
        "palbox1": palbox1, "palbox2": palbox2, "counts": counts,
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
