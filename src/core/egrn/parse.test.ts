import { describe, it, expect } from "vitest";
import { parseEgrnXml } from "./parse";

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<extract_about_property_room>
  <details_statement><group_top_requisites><date_formation>2026-09-26</date_formation></group_top_requisites></details_statement>
  <room_record>
    <object><common_data><type><code>002001003000</code><value>Помещение</value></type><cad_number>77:01:0001001:1234</cad_number></common_data></object>
    <cad_links><parent_cad_number><cad_number>77:01:0001001:1000</cad_number></parent_cad_number></cad_links>
    <params><area>42.9</area><purpose><code>206002000000</code><value>Жилое помещение</value></purpose></params>
    <location_in_build><level><floor_type><value>Этаж</value></floor_type><floor>1</floor></level></location_in_build>
    <address_room><address><address><readable_address>г. Москва, ул. Тестовая, д. 1, кв. 10</readable_address></address></address></address_room>
  </room_record>
  <right_records><right_record><right_data><right_type><code>001001000000</code><value>Собственность</value></right_type></right_data></right_record></right_records>
</extract_about_property_room>`;

describe("parseEgrnXml", () => {
  it("извлекает основные поля", () => {
    const r = parseEgrnXml(SAMPLE);
    expect(r.cadastralNumber).toBe("77:01:0001001:1234");
    expect(r.area).toBe("42.9");
    expect(r.address).toBe("г. Москва, ул. Тестовая, д. 1, кв. 10");
    expect(r.floor).toBe(1);
    expect(r.purpose).toBe("Жилое помещение");
    expect(r.rights).toEqual(["Собственность"]);
    expect(r.extractDate).toBe("2026-09-26");
    expect(r.buildingCadastralNumber).toBe("77:01:0001001:1000");
  });
  it("мусор — ничего не распознано", () => {
    expect(parseEgrnXml("<a>b</a>").recognized).toEqual([]);
  });
});
