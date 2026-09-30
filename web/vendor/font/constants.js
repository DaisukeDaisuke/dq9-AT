(function (global) {
  "use strict";

  const PUA_START = 0xE000;
  const PUA_END = 0xF8FF;
  const PIXEL_UNITS = 64;

  const GP2_TARGETS = [
    {
      key: "font",
      romPath: "data/pack/font.gp2",
      outputPrefix: "font",
      expected: {
        name: "font.gp2",
        size: 1247256,
        crc32: "3268D9BC",
        xxh64: "3449A0F8FBD00750",
        sha256: "d348398c703135a91d77126c33957165e4634daf8e4b17dfda0c9e99e3268f77",
      },
      expanded: {
        files: 528,
        bytes: 1425576,
        aggregateSha256: "1437c20f0e533b1a6dc3a34c8209dc9e7769bfa18c498edf01c9e8bdb8caf60e",
      },
    },
    {
      key: "font_lv5",
      romPath: "data/pack_lv5/font_lv5.gp2",
      outputPrefix: "font_lv5",
      expected: {
        name: "font_lv5.gp2",
        size: 489180,
        crc32: "1A19ED09",
        xxh64: "C24042E60D6D2284",
        sha256: "dd757e99a446cc01cb34c4c83891d79117afc55c7da5b916201b9ef80587dc25",
      },
      expanded: {
        files: 73,
        bytes: 619168,
        aggregateSha256: "3f0069a2d464c8d7e1ea32ab7d2294bdd063f28b6f9205d58d3b4c956c11b3fb",
      },
    },
  ];

  const GENERATED_EXPECTED_SHA256 = {
    "font_10x10.ttf": "3ead589d7ee9c374a754008362f889b016766cd0c4ad8998482576833630a0e7",
    "font_10x10_codepoints.json": "44e5d6d1b0a534bfc1f671b0d0defd997a4529c9550f929eef8fe7bc5445a533",
    "font_10x10_codepoints.md": "1e58a245039c8271392a64b6a8e2010b477756a14cd05234da927adeab04e58c",
    "font_12x12.ttf": "2c2ddb102159d32f75a8235edd87ad57ff2210e61e025f87799e2f856b1ca8a2",
    "font_12x12_codepoints.json": "a4e73f2d5f26b968c87ed7401b24544ede39f344471c13a5d722d421634cdc37",
    "font_12x12_codepoints.md": "b010a02d13b69be3615dcbf07e80bada899b7a877c77c059e4fbe713c3f13a5c",
    "font_8x7.ttf": "bc878236a10b003eddb7e59b529115ee944aa95df23e5538abac0a2dfcbf75cf",
    "font_8x7_codepoints.json": "b169fbc9f80bbc0b6958a3bc90308169c48de119ba45d108f76daab731df4ca3",
    "font_8x7_codepoints.md": "613f0793114ab9db13bb8cc28882b3797d3c4ea394a8701a89c7d6a6bff310f1",
    "font_8x8.ttf": "be7f37a503452688d15918de0790a6e9c72520e8e343c3946fd5247e6a874630",
    "font_8x8_codepoints.json": "b2289323bafa4061735fec4b85a9b443a963eeb9dca14b6ab384db188a982efc",
    "font_8x8_codepoints.md": "25bcdf267fefad16933fa07de6e585f101cac58c20454a37e0d4759b13a298e5",
    "font_text_aliases.json": "2cd3d92dc3f61ba5509e206dce80aa590981b44766db6e3ebd94ccd835cb838a",
    "font_text_aliases.php": "f935745e26678ac8c047a326bcdbe5858a8620029a7ad7d5622119f872228e1d",
    "font_ttf_index.md": "fc9b76e3678ff29ccd75b6d9900c6157ad36adb55ecdc4d3a39da2e8cb655bb1",
  };

  global.NdsFontConstants = {
    PUA_START,
    PUA_END,
    PIXEL_UNITS,
    GP2_TARGETS,
    GENERATED_EXPECTED_SHA256,
  };
})(globalThis);
