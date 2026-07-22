#!/usr/bin/env python3
# Moteur d'édition de save Palworld.
# Reçoit un GVAS décompressé (par Node), applique des éditions, réécrit le GVAS,
# puis RELIT le résultat pour vérifier chaque changement.
#   python edit_save.py <gvas_in> <gvas_out> <edits.json>
# Sortie : JSON de résultat sur stdout ({ ok, applied, notFound, verified, ... }).
#
# edits.json :
#   {
#     "pals":  [ { "instanceId": "...", "set": { <champ>: <valeur>, ... } } ],   # Level.sav (Pals ET joueurs)
#     "saveData": { "TechnologyPoint": 999, ... }                                 # <PlayerUId>.sav (racine SaveData)
#   }
# Champs d'un Pal/joueur : Talent_HP/Talent_Shot/Talent_Defense, Level, Rank,
#   Rank_HP/Rank_Attack/Rank_Defence/Rank_CraftSpeed (octets), Exp (Int64),
#   Gender, NickName, PassiveSkillList, et "Status:<nom>" (points de statut joueur).
#
# La (dé)compression .sav <-> GVAS est faite côté Node ; ce script ne touche qu'au GVAS.
# On stubbe 'palooz' (compresseur Oodle natif de palsav) : inutile ici, jamais appelé.
import sys, os, json, types, copy, uuid

try:
    sys.stdout.reconfigure(encoding="utf-8")  # noms de statut en japonais -> stdout UTF-8
except Exception:
    pass
sys.modules.setdefault("palooz", types.ModuleType("palooz"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palsav.gvas import GvasFile
from palsav.paltypes import PALWORLD_CUSTOM_PROPERTIES, PALWORLD_TYPE_HINTS

CHAR_KEY = ".worldSaveData.CharacterSaveParameterMap.Value.RawData"
STATUS_PREFIX = "Status:"

def _load_exp_table():
    try:
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "exp_table.json")
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return {}
EXP_TABLE = _load_exp_table()  # { "<niveau>": { "player": totalExp, "pal": palTotalExp } }

def exp_for_level(level, is_player):
    """XP cumulée cible pour un niveau (colonne joueur ou Pal). None si hors table."""
    row = EXP_TABLE.get(str(int(level)))
    if not row:
        return None
    return row.get("player" if is_player else "pal")

def _byte(v):  return {"id": None, "value": {"type": "None", "value": int(v)}, "type": "ByteProperty"}
def _int(v):   return {"id": None, "value": int(v), "type": "IntProperty"}
def _int64(v): return {"id": None, "value": int(v), "type": "Int64Property"}
def _enum_gender(v):
    val = v if str(v).startswith("EPalGenderType::") else f"EPalGenderType::{v}"
    return {"id": None, "value": {"type": "EPalGenderType", "value": val}, "type": "EnumProperty"}
def _str(v):   return {"id": None, "value": str(v), "type": "StrProperty"}
def _name_array(v):
    return {"array_type": "NameProperty", "id": None, "value": {"values": list(v)}, "type": "ArrayProperty"}

BYTE_FIELDS = {
    "Talent_HP", "Talent_Shot", "Talent_Defense",
    "Level", "Rank", "Rank_HP", "Rank_Attack", "Rank_Defence", "Rank_CraftSpeed",
}

def _status_entry(sp, name):
    """Retourne l'entrée {StatusName, StatusPoint} de GotStatusPointList pour `name`, ou None."""
    lst = sp.get("GotStatusPointList", {}).get("value", {}).get("values")
    if not lst:
        return None
    for it in lst:
        if it.get("StatusName", {}).get("value") == name:
            return it
    return None

def set_field(sp, field, value):
    """Applique une valeur sur le SaveParameter d'un Pal/joueur (mute en place, ou crée si absent)."""
    if field.startswith(STATUS_PREFIX):
        name = field[len(STATUS_PREFIX):]
        entry = _status_entry(sp, name)
        if entry is None:
            raise KeyError(f"Point de statut absent : {name}")
        entry["StatusPoint"]["value"] = int(value)
        return int(value)
    if field in BYTE_FIELDS:
        if field in sp and isinstance(sp[field].get("value"), dict) and "value" in sp[field]["value"]:
            sp[field]["value"]["value"] = int(value)
        else:
            sp[field] = _byte(value)
        return int(value)
    if field == "Exp":
        if field in sp:
            sp[field]["value"] = int(value)
        else:
            sp[field] = _int64(value)
        return int(value)
    if field == "Gender":
        sp[field] = _enum_gender(value)
        return sp[field]["value"]["value"]
    if field == "NickName":
        sp[field] = _str(value)
        return value
    if field == "PassiveSkillList":
        sp[field] = _name_array(value)
        return list(value)
    if field == "EquipWaza":
        # value = liste d'assets (ex. "PowerBall") -> "EPalWazaID::PowerBall"
        full = [w if str(w).startswith("EPalWazaID::") else f"EPalWazaID::{w}" for w in value]
        sp["EquipWaza"] = {"array_type": "EnumProperty", "id": None, "value": {"values": full}, "type": "ArrayProperty"}
        # union dans MasteredWaza (le jeu exige que les moves équipés soient connus)
        cur = []
        if "MasteredWaza" in sp:
            try: cur = list(sp["MasteredWaza"]["value"]["values"])
            except Exception: cur = []
        merged = list(dict.fromkeys([*cur, *full]))
        sp["MasteredWaza"] = {"array_type": "EnumProperty", "id": None, "value": {"values": merged}, "type": "ArrayProperty"}
        return [str(w).replace("EPalWazaID::", "") for w in full]
    raise ValueError(f"Champ non supporté : {field}")

def read_field(sp, field):
    if field.startswith(STATUS_PREFIX):
        e = _status_entry(sp, field[len(STATUS_PREFIX):])
        return e["StatusPoint"]["value"] if e else None
    if field not in sp:
        return None
    if field in BYTE_FIELDS:
        return sp[field]["value"]["value"]
    if field == "Exp":
        return sp[field]["value"]
    if field == "Gender":
        return sp[field]["value"]["value"]
    if field == "NickName":
        return sp[field]["value"]
    if field == "PassiveSkillList":
        return sp[field]["value"]["values"]
    if field == "EquipWaza":
        return [str(w).replace("EPalWazaID::", "") for w in sp[field]["value"]["values"]]
    return None

def index_chars(gvas):
    """instanceId (minuscule) -> SaveParameter (Pals ET joueurs)."""
    out = {}
    entries = gvas.properties["worldSaveData"]["value"]["CharacterSaveParameterMap"]["value"]
    for e in entries:
        try:
            iid = e["key"]["InstanceId"]["value"]
            out[str(iid).lower()] = e["value"]["RawData"]["value"]["object"]["SaveParameter"]["value"]
        except Exception:
            continue
    return out

# --- Champs racine SaveData (player.sav) ---
SAVEDATA_INT = {"TechnologyPoint", "bossTechnologyPoint"}
RECIPE_FIELD = "UnlockedRecipeTechnologyNames"

def _load_tech_list():
    try:
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tech_list.json")
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return []
TECH_LIST = _load_tech_list()  # liste complète des technos (assets)

def _name_array_prop(values):
    return {"array_type": "NameProperty", "id": None, "value": {"values": list(values)}, "type": "ArrayProperty"}

def set_savedata(sd, field, value):
    if field in SAVEDATA_INT:
        if field in sd:
            sd[field]["value"] = int(value)
        else:
            sd[field] = _int(value)
        return int(value)
    if field == "UnlockAllTech":  # union des recettes existantes + liste complète
        cur = []
        if RECIPE_FIELD in sd:
            try: cur = list(sd[RECIPE_FIELD]["value"]["values"])
            except Exception: cur = []
        merged = list(dict.fromkeys([*cur, *TECH_LIST]))  # dédoublonne en gardant l'ordre
        sd[RECIPE_FIELD] = _name_array_prop(merged)
        return len(merged)
    if field == RECIPE_FIELD:  # liste explicite de recettes
        sd[field] = _name_array_prop(value)
        return len(value)
    raise ValueError(f"Champ SaveData non supporté : {field}")

def read_savedata(sd, field):
    if field in ("UnlockAllTech", RECIPE_FIELD):
        try: return len(sd[RECIPE_FIELD]["value"]["values"])
        except Exception: return None
    return sd[field]["value"] if field in sd else None

# --- Inventaire (ItemContainerSaveData de Level.sav) ---
IC_KEY = ".worldSaveData.ItemContainerSaveData.Value.RawData"
ICS_KEY = ".worldSaveData.ItemContainerSaveData.Value.Slots.Slots.RawData"
ZERO_GUID = uuid.UUID(int=0)

def index_containers(gvas):
    """GUID (minuscule) -> valeur du conteneur (SlotNum, Slots, ...)."""
    out = {}
    for e in gvas.properties["worldSaveData"]["value"]["ItemContainerSaveData"]["value"]:
        try:
            out[str(e["key"]["ID"]["value"]).lower()] = e["value"]
        except Exception:
            continue
    return out

def _slot_rv(slot):
    return slot["RawData"]["value"]

def _template_slot(containers):
    """Un slot existant (n'importe lequel) à cloner pour créer de nouveaux slots."""
    for cont in containers.values():
        vals = cont.get("Slots", {}).get("value", {}).get("values", [])
        if vals:
            return vals[0]
    return None

def apply_inventory(containers, inv_ops):
    """Applique les opérations d'inventaire. Retourne (changes, template utilisé pour add)."""
    template = None
    changes = []
    for op in inv_ops:
        cid = str(op["containerId"]).lower()
        cont = containers.get(cid)
        if cont is None:
            changes.append({**op, "result": "container_absent"})
            continue
        slots = cont["Slots"]["value"]["values"]
        action = op["action"]
        if action == "count":
            for s in slots:
                if _slot_rv(s)["slot_index"] == op["slotIndex"]:
                    _slot_rv(s)["count"] = int(op["count"]); changes.append(op); break
        elif action == "item":
            for s in slots:
                if _slot_rv(s)["slot_index"] == op["slotIndex"]:
                    rv = _slot_rv(s)
                    rv["item"]["static_id"] = str(op["staticId"])
                    rv["item"]["dynamic_id"]["created_world_id"] = ZERO_GUID
                    rv["item"]["dynamic_id"]["local_id_in_created_world"] = ZERO_GUID
                    rv["count"] = int(op.get("count", rv["count"])); changes.append(op); break
        elif action == "remove":
            cont["Slots"]["value"]["values"] = [s for s in slots if _slot_rv(s)["slot_index"] != op["slotIndex"]]
            changes.append(op)
        elif action == "add":
            slotnum = cont["SlotNum"]["value"]
            occupied = {_slot_rv(s)["slot_index"] for s in slots}
            free = next((i for i in range(slotnum) if i not in occupied), None)
            if free is None:
                changes.append({**op, "result": "container_full"}); continue
            src = slots[0] if slots else (template or _template_slot(containers))
            if src is None:
                changes.append({**op, "result": "no_template"}); continue
            new = copy.deepcopy(src)
            rv = _slot_rv(new)
            rv["slot_index"] = free
            rv["count"] = int(op["count"])
            rv["item"]["static_id"] = str(op["staticId"])
            rv["item"]["dynamic_id"]["created_world_id"] = ZERO_GUID
            rv["item"]["dynamic_id"]["local_id_in_created_world"] = ZERO_GUID
            cont["Slots"]["value"]["values"].append(new)
            changes.append({**op, "slotIndex": free})
    return changes

# --- Création de Pals (clone d'un Pal existant du joueur + surcharge) ---
CC_KEY = ".worldSaveData.CharacterContainerSaveData.Value.Slots.Slots.RawData"
GRP_KEY = ".worldSaveData.GroupSaveDataMap"
MO_KEY = ".worldSaveData.MapObjectSaveData"
ZERO_GUID = "00000000-0000-0000-0000-000000000000"

def _uuid(v):
    try: return v if isinstance(v, uuid.UUID) else uuid.UUID(str(v))
    except Exception: return uuid.UUID(int=0)

def _owner_of(e, sp):
    o = sp.get("OwnerPlayerUId", {}).get("value")
    if o is None:
        o = (e.get("key") or {}).get("PlayerUId", {}).get("value")
    return str(o).lower() if o is not None else None

def _find_char_container(wsd, guid):
    for e in wsd.get("CharacterContainerSaveData", {}).get("value", []):
        try:
            if str(e["key"]["ID"]["value"]).lower() == str(guid).lower():
                return e["value"]
        except Exception:
            continue
    return None

def _register_guild(wsd, group_id, iid):
    if group_id is None:
        return False
    gid = str(group_id).lower()
    for g in wsd.get("GroupSaveDataMap", {}).get("value", []):
        try:
            if str(g["key"]).lower() != gid:
                continue
            grd = g["value"]["RawData"]["value"]
            hids = grd.get("individual_character_handle_ids", [])
            hids.append({"guid": uuid.UUID(int=0), "instance_id": iid})
            grd["individual_character_handle_ids"] = hids
            return True
        except Exception:
            continue
    return False

def set_guild_admin(gvas, new_admin):
    """Transfère le rôle de maître de guilde au joueur new_admin (qui doit être membre)."""
    wsd = gvas.properties["worldSaveData"]["value"]
    nu = str(new_admin).lower()
    for g in wsd.get("GroupSaveDataMap", {}).get("value", []):
        grd = g["value"]["RawData"]["value"]
        if "admin_player_uid" not in grd:
            continue
        players = grd.get("players", [])
        if not any(str(p.get("player_uid")).lower() == nu for p in players):
            continue
        cur_admin = str(grd.get("admin_player_uid")).lower()
        admin_role = next((p.get("role") for p in players if str(p.get("player_uid")).lower() == cur_admin), None)
        grd["admin_player_uid"] = _uuid(new_admin)
        if admin_role is not None:
            for p in players:
                if str(p.get("player_uid")).lower() == nu:
                    p["role"] = admin_role
        return {"guild": str(grd.get("guild_name")), "admin": nu}
    return {"error": "guild_or_player_not_found"}

def create_pals(gvas, specs):
    wsd = gvas.properties["worldSaveData"]["value"]
    entries = wsd["CharacterSaveParameterMap"]["value"]
    results = []
    for spec in specs:
        owner = str(spec["ownerUid"]).lower()
        palbox = str(spec["palboxId"])
        # 1) trouve un Pal source du même joueur (structure 1.0 garantie valide)
        src = None
        for e in entries:
            try:
                sp = e["value"]["RawData"]["value"]["object"]["SaveParameter"]["value"]
            except Exception:
                continue
            if sp.get("IsPlayer", {}).get("value") is True:
                continue
            if _owner_of(e, sp) == owner:
                src = e; break
        if src is None:
            results.append({"error": "no_source_pal", "ownerUid": owner}); continue

        # 2) conteneur boîte + slot libre
        cont = _find_char_container(wsd, palbox)
        if cont is None:
            results.append({"error": "no_palbox", "ownerUid": owner}); continue
        cslots = cont["Slots"]["value"]["values"]
        occupied = {s.get("SlotIndex", {}).get("value") for s in cslots}
        slotnum = cont.get("SlotNum", {}).get("value", 0)
        free = next((i for i in range(slotnum) if i not in occupied), None)
        if free is None:
            results.append({"error": "palbox_full", "ownerUid": owner}); continue

        # 3) clone + surcharge
        new_iid = uuid.uuid4()
        entry = copy.deepcopy(src)
        raw = entry["value"]["RawData"]["value"]
        sp = raw["object"]["SaveParameter"]["value"]
        group_id = raw.get("group_id")
        entry["key"]["InstanceId"]["value"] = new_iid
        entry["key"]["PlayerUId"]["value"] = uuid.UUID(int=0)
        sp["CharacterID"]["value"] = spec["characterId"]
        set_field(sp, "Level", int(spec.get("level", 1)))
        ex = exp_for_level(int(spec.get("level", 1)), False)
        if ex is not None: set_field(sp, "Exp", ex)
        for f, k in (("Talent_HP", "ivHp"), ("Talent_Shot", "ivShot"), ("Talent_Defense", "ivDefense")):
            if k in spec: set_field(sp, f, int(spec[k]))
        if spec.get("gender"): set_field(sp, "Gender", spec["gender"])
        if spec.get("nickname"): set_field(sp, "NickName", spec["nickname"])
        set_field(sp, "PassiveSkillList", spec.get("passives", []))
        set_field(sp, "Rank", int(spec.get("rank", 1)))
        # compétences vidées (espèce différente)
        for w in ("EquipWaza", "MasteredWaza"):
            sp[w] = {"array_type": "EnumProperty", "id": None, "value": {"values": []}, "type": "ArrayProperty"}
        # place dans la boîte
        sp["SlotId"]["value"]["ContainerId"]["value"]["ID"]["value"] = _uuid(palbox)
        sp["SlotId"]["value"]["SlotIndex"]["value"] = free

        entries.append(entry)
        # 4) slot de la boîte -> pointe vers le nouveau Pal
        newslot = copy.deepcopy(cslots[0])
        newslot["SlotIndex"]["value"] = free
        rv = newslot["RawData"]["value"]
        rv["player_uid"] = uuid.UUID(int=0)
        rv["instance_id"] = new_iid
        rv["permission_tribe_id"] = 0
        cslots.append(newslot)
        # 5) enregistrement guilde
        guild = _register_guild(wsd, group_id, new_iid)
        results.append({"instanceId": str(new_iid), "characterId": spec["characterId"], "slotIndex": free, "guild": guild})
    return results

# ---------------------------------------------------------------------------
# Déverrouillage des coffres/étals privés (MapObjectSaveData)
#
# Le verrou privé d'un coffre est stocké dans `private_lock_player_uid` :
#   - GUID d'un joueur  -> coffre verrouillé (accessible seulement à lui)
#   - GUID zéro          -> accessible à toute la guilde
# Les étals (booth) ont en plus un octet `is_private_lock` (0/1).
# On remet ces deux champs à « accessible à tous » partout dans la carte.
# ---------------------------------------------------------------------------
def unlock_all_map_objects(gvas):
    wsd = gvas.properties["worldSaveData"]["value"]
    mo = wsd.get("MapObjectSaveData")
    if not mo:
        return {"scanned": 0, "unlocked": 0, "byType": {}}
    # On compte les OBJETS distincts (un étal a les deux champs de verrou : on ne
    # veut pas le compter deux fois). `scanned` = objets porteurs d'un verrou.
    stats = {"scanned": 0, "unlocked": 0}
    by_type = {}

    def walk(o, ctype=None):
        if isinstance(o, dict):
            ct = o.get("concrete_model_type", ctype)
            has_lock, changed = False, False
            if "private_lock_player_uid" in o:
                has_lock = True
                if str(o["private_lock_player_uid"]).lower() != ZERO_GUID:
                    o["private_lock_player_uid"] = ZERO_GUID
                    changed = True
            if "is_private_lock" in o:
                has_lock = True
                if o["is_private_lock"]:
                    o["is_private_lock"] = 0
                    changed = True
            if has_lock:
                stats["scanned"] += 1
            if changed:
                stats["unlocked"] += 1
                by_type[ct] = by_type.get(ct, 0) + 1
            for v in o.values():
                walk(v, ct)
        elif isinstance(o, list):
            for i in o:
                walk(i, ctype)

    walk(mo["value"])
    return {"scanned": stats["scanned"], "unlocked": stats["unlocked"], "byType": by_type}

def count_remaining_locks(gvas):
    """Compte les verrous privés encore actifs (pour la vérification post-écriture)."""
    wsd = gvas.properties["worldSaveData"]["value"]
    mo = wsd.get("MapObjectSaveData")
    if not mo:
        return 0
    rem = {"n": 0}

    def walk(o):
        if isinstance(o, dict):
            if "private_lock_player_uid" in o and str(o["private_lock_player_uid"]).lower() != ZERO_GUID:
                rem["n"] += 1
            if o.get("is_private_lock"):
                rem["n"] += 1
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for i in o:
                walk(i)

    walk(mo["value"])
    return rem["n"]

def main():
    gvas_in, gvas_out, edits_path = sys.argv[1], sys.argv[2], sys.argv[3]
    edits = json.load(open(edits_path, encoding="utf-8"))
    char_edits = edits.get("pals", [])
    savedata_edits = edits.get("saveData", {})
    inv_ops = edits.get("inventory", [])
    create_specs = edits.get("createPals", [])
    guild_admin = edits.get("guildAdmin")
    unlock_chests = bool(edits.get("unlockChests"))

    data = open(gvas_in, "rb").read()
    need_char = bool(char_edits)
    need_inv = bool(inv_ops)
    need_create = bool(create_specs)
    need_guild = bool(guild_admin)
    need_unlock = unlock_chests
    wanted = set()
    if need_char:
        wanted.add(CHAR_KEY)
    if need_inv:
        wanted.update((IC_KEY, ICS_KEY))
    if need_create:
        wanted.update((CHAR_KEY, CC_KEY, GRP_KEY))
    if need_guild:
        wanted.add(GRP_KEY)
    if need_unlock:
        wanted.add(MO_KEY)
    cprops = {k: v for k, v in PALWORLD_CUSTOM_PROPERTIES.items() if k in wanted}
    gvas = GvasFile.read(data, type_hints=PALWORLD_TYPE_HINTS, custom_properties=cprops)

    applied, not_found = [], []
    inv_changes = []
    created = []

    # --- éditions de personnages (Level.sav) ---
    if need_char:
        chars = index_chars(gvas)
        for pe in char_edits:
            iid = str(pe["instanceId"]).lower()
            sp = chars.get(iid)
            if sp is None:
                not_found.append(iid)
                continue
            setspec = pe.get("set", {})
            changes = {}
            for field, value in setspec.items():
                changes[field] = set_field(sp, field, value)
            # Auto-XP : changer le niveau sans fournir Exp -> recalcule l'XP cumulée
            # (sinon le jeu re-corrige le niveau depuis l'XP au chargement).
            if "Level" in setspec and "Exp" not in setspec:
                is_player = (sp.get("IsPlayer") or {}).get("value") is True
                ex = exp_for_level(setspec["Level"], is_player)
                if ex is not None:
                    changes["Exp"] = set_field(sp, "Exp", ex)
            applied.append({"kind": "char", "instanceId": iid, "changes": changes})

    # --- éditions racine SaveData (player.sav) ---
    sd_changes = {}
    if savedata_edits:
        sd = gvas.properties["SaveData"]["value"]
        for field, value in savedata_edits.items():
            sd_changes[field] = set_savedata(sd, field, value)
        applied.append({"kind": "saveData", "changes": sd_changes})

    # --- éditions d'inventaire (Level.sav) ---
    if need_inv:
        containers = index_containers(gvas)
        inv_changes = apply_inventory(containers, inv_ops)
        applied.append({"kind": "inventory", "changes": inv_changes})

    # --- création de Pals (Level.sav) ---
    if need_create:
        created = create_pals(gvas, create_specs)
        applied.append({"kind": "createPals", "created": created})

    # --- transfert de maître de guilde (Level.sav) ---
    guild_result = None
    if need_guild:
        guild_result = set_guild_admin(gvas, guild_admin["newAdminUid"])
        applied.append({"kind": "guildAdmin", "result": guild_result})

    # --- déverrouillage des coffres/étals privés (Level.sav) ---
    unlock_result = None
    if need_unlock:
        unlock_result = unlock_all_map_objects(gvas)
        applied.append({"kind": "unlockChests", "result": unlock_result})

    out = gvas.write(cprops)
    open(gvas_out, "wb").write(out)

    # --- vérification : relire le GVAS écrit et confirmer chaque changement ---
    gvas2 = GvasFile.read(out, type_hints=PALWORLD_TYPE_HINTS, custom_properties=cprops)
    verified, mismatches = True, []
    if need_char:
        chars2 = index_chars(gvas2)
        for a in applied:
            if a["kind"] != "char":
                continue
            sp2 = chars2.get(a["instanceId"])
            for field, want in a["changes"].items():
                got = read_field(sp2, field) if sp2 else None
                if got != want:
                    verified = False
                    mismatches.append({"instanceId": a["instanceId"], "field": field, "want": want, "got": got})
    if sd_changes:
        sd2 = gvas2.properties["SaveData"]["value"]
        for field, want in sd_changes.items():
            got = read_savedata(sd2, field)
            if got != want:
                verified = False
                mismatches.append({"saveData": field, "want": want, "got": got})
    if need_inv:
        conts2 = index_containers(gvas2)
        for op in inv_changes:
            if op.get("result") in ("container_absent", "container_full", "no_template"):
                verified = False
                mismatches.append({"inventory": op})
                continue
            cont = conts2.get(str(op["containerId"]).lower())
            slots = cont["Slots"]["value"]["values"] if cont else []
            by_idx = {_slot_rv(s)["slot_index"]: _slot_rv(s) for s in slots}
            act = op["action"]
            if act == "remove":
                if op["slotIndex"] in by_idx:
                    verified = False; mismatches.append({"inventory": "remove", "slotIndex": op["slotIndex"]})
            else:  # count / item / add
                rv = by_idx.get(op["slotIndex"])
                ok = rv is not None
                if ok and "count" in op:
                    ok = rv["count"] == int(op["count"])
                if ok and "staticId" in op:
                    ok = rv["item"]["static_id"] == str(op["staticId"])
                if not ok:
                    verified = False; mismatches.append({"inventory": act, "slotIndex": op.get("slotIndex"), "got": rv})
    if need_create:
        idx2 = index_chars(gvas2)
        for c in created:
            if c.get("error"):
                verified = False; mismatches.append({"create": c}); continue
            sp2 = idx2.get(str(c["instanceId"]).lower())
            if sp2 is None or sp2.get("CharacterID", {}).get("value") != c["characterId"]:
                verified = False; mismatches.append({"create": "pal_absent", "instanceId": c["instanceId"]})
    if need_guild:
        if guild_result and guild_result.get("error"):
            verified = False; mismatches.append({"guildAdmin": guild_result})
        else:
            nu = str(guild_admin["newAdminUid"]).lower()
            groups2 = gvas2.properties["worldSaveData"]["value"].get("GroupSaveDataMap", {}).get("value", [])
            ok = any(str(g["value"]["RawData"]["value"].get("admin_player_uid")).lower() == nu
                     for g in groups2 if "admin_player_uid" in g["value"]["RawData"]["value"])
            if not ok:
                verified = False; mismatches.append({"guildAdmin": "not_applied"})
    if need_unlock:
        remaining = count_remaining_locks(gvas2)
        if remaining:
            verified = False; mismatches.append({"unlockChests": "remaining", "count": remaining})

    print(json.dumps({
        "ok": True,
        "gvasLen": len(out),
        "unchangedSize": len(out) == len(data),
        "appliedCount": len(applied),
        "notFound": not_found,
        "verified": verified,
        "mismatches": mismatches,
        "applied": applied,
    }, ensure_ascii=False))

if __name__ == "__main__":
    main()
