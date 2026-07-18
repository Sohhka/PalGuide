#!/usr/bin/env python3
# Lit l'inventaire principal (sac) d'un joueur via palsav.
#   python read_inventory.py <level.gvas> <player.gvas>
# Sortie JSON : { containerId, slotNum, slots: [{slotIndex, id, count, dyn}] }
# (dyn = objet à données dynamiques : arme/armure/œuf, quantité non librement éditable)
import sys, os, json, types
try: sys.stdout.reconfigure(encoding="utf-8")
except Exception: pass
sys.modules.setdefault("palooz", types.ModuleType("palooz"))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from palsav.gvas import GvasFile
from palsav.paltypes import PALWORLD_CUSTOM_PROPERTIES, PALWORLD_TYPE_HINTS

IC = ".worldSaveData.ItemContainerSaveData.Value.RawData"
ICS = ".worldSaveData.ItemContainerSaveData.Value.Slots.Slots.RawData"
ZERO = "00000000-0000-0000-0000-000000000000"

def main():
    level_gvas, player_gvas = sys.argv[1], sys.argv[2]

    # 1) GUID du sac principal (player.sav)
    pl = GvasFile.read(open(player_gvas, "rb").read(), type_hints=PALWORLD_TYPE_HINTS, custom_properties={})
    sd = pl.properties["SaveData"]["value"]
    inv = sd.get("InventoryInfo") or sd.get("inventoryInfo")
    common = None
    if inv:
        try:
            common = str(inv["value"]["CommonContainerId"]["value"]["ID"]["value"]).lower()
        except Exception:
            common = None
    if not common:
        print(json.dumps({"error": "no_common_container"})); return

    # 2) slots du conteneur (Level.sav)
    cprops = {k: v for k, v in PALWORLD_CUSTOM_PROPERTIES.items() if k in (IC, ICS)}
    lvl = GvasFile.read(open(level_gvas, "rb").read(), type_hints=PALWORLD_TYPE_HINTS, custom_properties=cprops)
    for e in lvl.properties["worldSaveData"]["value"]["ItemContainerSaveData"]["value"]:
        if str(e["key"]["ID"]["value"]).lower() != common:
            continue
        val = e["value"]
        slot_num = val.get("SlotNum", {}).get("value", 0)
        out = []
        for s in val["Slots"]["value"]["values"]:
            rv = s["RawData"]["value"]
            item = rv.get("item", {})
            sid = item.get("static_id") or ""
            if not sid or sid == "None":
                continue
            did = item.get("dynamic_id", {})
            dyn = str(did.get("local_id_in_created_world", ZERO)) != ZERO
            out.append({"slotIndex": rv.get("slot_index"), "id": sid, "count": rv.get("count", 0), "dyn": dyn})
        out.sort(key=lambda x: x["slotIndex"])
        print(json.dumps({"containerId": common, "slotNum": slot_num, "slots": out}, ensure_ascii=False))
        return
    print(json.dumps({"error": "container_not_found", "containerId": common}))

if __name__ == "__main__":
    main()
