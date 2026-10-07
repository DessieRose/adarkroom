/**
 * Data table for the farming feature. Every crop value lives here;
 * other modules read from Crops.List and never hardcode crop numbers.
 *
 * The key of each entry is the veggie's name in stores, e.g. stores["carrot"].
 */
const CROPS = {
  SEED_WEIGHT: 0.1, // bag space of any seed on the path

  List: {
    carrot: {
      name: _("carrot"), // veggie, shown in stores and on the path
      seed: "carrot seed", // key in stores, e.g. stores["carrot seed"]
      seedName: _("carrot seed"),
      text: [_("a few scraggly carrots grow wild between the roots.")],
      notification: _("something green, in all the grey."),
      growTime: 30, // seconds from planting to ready
      yield: 3, // veggies per harvest
      heal: 3, // hp restored when eaten (cured meat is 8)
      weight: 0.5, // bag space on the path (cured meat is 1)
      drop: {
        terrain: "FOREST", // key of World.TILE: 'FOREST', 'FIELD' or 'BARRENS'
        minDistance: 0, // distance from the village, as in World.getDistance()
        maxDistance: 8,
        chance: 0.2, // chance the seed is in the loot, 0 to 1
      },
      plantMsg: _("seeds pressed into grey soil."),
      harvestMsg: _("thin roots, pulled from the dirt."),
    },

    cabbage: {
      name: _("cabbage"),
      seed: "cabbage seed",
      seedName: _("cabbage seed"),
      text: [
        _("a clearing, once a garden. the fence has rotted to stumps."),
        _(
          "a few seed heads still cling to a bolted cabbage, gone tall and bitter.",
        ),
      ],
      notification: _("someone tended this ground, once."),
      growTime: 45,
      yield: 2,
      heal: 4,
      weight: 0.5,
      drop: {
        terrain: "FOREST",
        minDistance: 8,
        maxDistance: 18,
        chance: 0.2,
      },
      plantMsg: _("pale seeds scattered over the furrows."),
      harvestMsg: _("tight green heads, cut from the stalk."),
    },

    potato: {
      name: _("potato"),
      seed: "potato seed",
      seedName: _("potato seed"),
      text: [
        _("a collapsed root cellar, half buried in the grass."),
        _(
          "in the dark, a sack of withered potatoes. pale shoots reach for the light.",
        ),
      ],
      notification: _("the ground gives way to a hollow."),
      growTime: 70,
      yield: 2,
      heal: 5,
      weight: 0.5,
      drop: {
        terrain: "FIELD",
        minDistance: 18,
        maxDistance: 28,
        chance: 0.15,
      },
      plantMsg: _("seed potatoes buried in the dark earth."),
      harvestMsg: _("heavy tubers, knocked loose from the soil."),
    },

    dragonfruit: {
      name: _("dragonfruit"),
      seed: "dragonfruit seed",
      seedName: _("dragonfruit seed"),
      text: [
        _("a cactus, impossibly alive in the dust."),
        _(
          "a single red fruit hangs from it, split open. black seeds glisten inside.",
        ),
      ],
      notification: _("a flash of red in the dust."),
      growTime: 95,
      yield: 2,
      heal: 6,
      weight: 0.5,
      drop: {
        terrain: "BARRENS",
        minDistance: 22,
        maxDistance: 32,
        chance: 0.1,
      },
      plantMsg: _("strange black seeds pressed into the ash."),
      harvestMsg: _("scaled red fruit, bright against the grey."),
    },

    hibiscus: {
      name: _("hibiscus"),
      seed: "hibiscus seed",
      seedName: _("hibiscus seed"),
      text: [
        _(
          "deep in the trees, a ring of red flowers. no other plant grows near.",
        ),
        _("the seed pods rattle in the wind, dry and ready."),
      ],
      notification: _("color, where there should be none."),

      growTime: 120,
      yield: 1,
      heal: 8,
      weight: 0.5,
      drop: {
        terrain: "FOREST",
        minDistance: 28,
        maxDistance: 40,
        chance: 0.05,
      },
      plantMsg: _("a single bright seed, laid in the soil."),
      harvestMsg: _("red blooms, open where nothing should grow."),
    },
  },
};
