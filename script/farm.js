/**
 * Module that registers the farming functionality.
 *
 * The Farm tab turns up once the farm is built, which the builder only offers
 * after the first seed has been found. The farm starts with a single field and
 * can be extended to Farm._MAX_FIELDS from inside the tab.
 */

const Farm = {
  name: _('The Farm'),
  _STORES_OFFSET: 0,
  _MAX_FIELDS: 5, // the farm comes with one field, the other four are bought
  _FARMER_YIELD: 1, // extra veggies per harvest, per farmer on that crop
  _TICK: 1000, // how often the growth timers are redrawn

  options: {},

  _notified: {}, // crops already announced as ready, not saved

  /* Crop table ------------------------------------------------------------ */

  crops: () => typeof CROPS === 'undefined' ? {} : CROPS.List,

  crop: key => Farm.crops()[key],

  /* Unlocks --------------------------------------------------------------- */

  // called on startup and on every state change, until the farm is built
  checkUnlock: () => {
    if (Farm._initialized) {
      return;
    }
    if ($SM.get('game.buildings["farm"]', true) > 0) {
      Farm.init();
    }
  },

  // sets the permanent unlock for a crop's seed
  unlockCrop: key => {
    if (Farm.crop(key) && !$SM.get(`game.seeds["${key}"]`)) {
      $SM.set(`game.seeds["${key}"]`, true);
    }
  },

  isUnlocked: key => $SM.get(`game.seeds["${key}"]`) === true,

  // the builder won't offer a farm until there is something to put in it
  anySeedFound: () => Object.keys(Farm.crops()).some(Farm.isUnlocked),

  /* Fields ---------------------------------------------------------------- */

  fields: () => Math.max(1, $SM.get('game.farm.fields', true)),

  fieldCost: () => ({ 'wood': 100 * Farm.fields() }),

  fieldsInUse: () => Object.keys(Farm.getPlots()).length,

  hasFreeField: () => Farm.fieldsInUse() < Farm.fields(),

  buyField: () => {
    if (Farm.fields() >= Farm._MAX_FIELDS) {
      return;
    }

    const storeMod = {};
    for (const [ key, value ] of Object.entries(Farm.fieldCost())) {
      const have = $SM.get(`stores["${key}"]`, true);
      if (have < value) {
        Notifications.notify(Farm, _('not enough {0}', _(key)));
        return;
      }
      storeMod[key] = have - value;
    }
    $SM.setM('stores', storeMod);
    $SM.add('game.farm.fields', 1);

    Notifications.notify(Farm, _('another strip of ground is turned over'));
    AudioEngine.playSound(AudioLibrary.BUILD);
  },

  /* Plots ----------------------------------------------------------------- */

  getPlots: () => {
    const plots = $SM.get('game.farm.plots');
    return plots && typeof plots === 'object' && !Array.isArray(plots) ? plots : {};
  },

  // seconds until this crop can be harvested
  timeLeft: key => {
    const crop = Farm.crop(key);
    const plot = Farm.getPlots()[key];
    if (!crop || !plot) {
      return 0;
    }
    return Math.max(0, Math.ceil(crop.growTime - (Date.now() - plot.planted) / 1000));
  },

  isGrowing: key => Boolean(Farm.getPlots()[key]),

  isReady: key => Farm.isGrowing(key) && Farm.timeLeft(key) === 0,

  /* Farmers --------------------------------------------------------------- */

  // the pool of villagers working the farm, set in the village
  totalFarmers: () => $SM.get('game.workers["farmer"]', true),

  farmersOn: key => $SM.get(`game.farm.farmers["${key}"]`, true),

  assignedFarmers: () => Object.values($SM.get('game.farm.farmers') || {})
    .reduce((sum, num) => sum + (num || 0), 0),

  freeFarmers: () => Math.max(0, Farm.totalFarmers() - Farm.assignedFarmers()),

  // trims crop assignments back if the farmer pool has shrunk
  syncFarmers: () => {
    let excess = Farm.assignedFarmers() - Farm.totalFarmers();
    if (excess <= 0) {
      return;
    }
    const farmers = $SM.get('game.farm.farmers') || {};
    for (const key of Object.keys(farmers).reverse()) {
      if (excess <= 0) {
        break;
      }
      const taken = Math.min(farmers[key] || 0, excess);
      farmers[key] -= taken;
      excess -= taken;
    }
    $SM.set('game.farm.farmers', farmers);
  },

  increaseFarmer: function (e) {
    const key = $(this).closest('.cropRow').attr('key');
    if (Farm.freeFarmers() > 0) {
      const amt = Math.min(Farm.freeFarmers(), e.data);
      $SM.add(`game.farm.farmers["${key}"]`, amt);
    }
  },

  decreaseFarmer: function (e) {
    const key = $(this).closest('.cropRow').attr('key');
    const amt = Math.min(Farm.farmersOn(key), e.data);
    if (amt > 0) {
      $SM.add(`game.farm.farmers["${key}"]`, -amt);
    }
  },

  /* Actions --------------------------------------------------------------- */

  // one button per crop: it sows, then waits out the grow time, then harvests
  tend: button => {
    const key = $(button).attr('cropKey');
    if (Farm.isGrowing(key)) {
      Farm.harvest(key);
    } else {
      Farm.plant(key);
    }
  },

  plant: key => {
    const crop = Farm.crop(key);
    const plots = Farm.getPlots();

    if (!crop || plots[key] || !Farm.isUnlocked(key)) {
      return;
    }
    if (!Farm.hasFreeField()) {
      Notifications.notify(Farm, _('no field left to sow'));
      return;
    }

    plots[key] = { planted: Date.now() };
    $SM.set('game.farm.plots', plots);

    Notifications.notify(Farm, crop.plantMsg);
    AudioEngine.playSound(AudioLibrary.BUILD);
  },

  harvest: key => {
    const crop = Farm.crop(key);
    const plots = Farm.getPlots();

    if (!crop || !Farm.isReady(key)) {
      return;
    }

    delete Farm._notified[key + ':' + plots[key].planted];
    delete plots[key];
    $SM.set('game.farm.plots', plots);
    $SM.add(`stores["${key}"]`, Farm.yieldFor(key));

    Notifications.notify(Farm, crop.harvestMsg);
    AudioEngine.playSound(AudioLibrary.GATHER_WOOD);
  },

  // farmers don't work the field for you, they make the harvest worth more
  yieldFor: key => {
    const crop = Farm.crop(key);
    return crop ? crop.yield + Farm.farmersOn(key) * Farm._FARMER_YIELD : 0;
  },

  /* Views ----------------------------------------------------------------- */

  updateFields: () => {
    let section = $('#fieldBtns');
    let needsAppend = false;
    if (section.length === 0) {
      needsAppend = true;
      section = $('<div>').attr('id', 'fieldBtns').css('opacity', 0);
      new Button.Button({
        id: 'buyFieldButton',
        text: _('buy field'),
        click: Farm.buyField,
        cost: Farm.fieldCost(),
        width: '80px'
      }).appendTo(section);
      $('<div>').attr('id', 'fieldStatus').appendTo(section);
    }

    const atMax = Farm.fields() >= Farm._MAX_FIELDS;
    const button = $('#buyFieldButton', section);

    // the next field always costs more than the last, so the tooltip is rebuilt
    const tooltip = $('.tooltip', button).empty();
    if (!atMax) {
      for (const [ key, value ] of Object.entries(Farm.fieldCost())) {
        $('<div>').addClass('row_key').text(_(key)).appendTo(tooltip);
        $('<div>').addClass('row_val').text(value).appendTo(tooltip);
      }
    }
    Button.setDisabled(button, atMax);

    $('#fieldStatus', section).text(_('fields {0}/{1}', Farm.fields(), Farm._MAX_FIELDS));

    if (needsAppend) {
      section.appendTo(Farm.panel).animate({ opacity: 1 }, 300, 'linear');
    }
  },

  updateCrops: () => {
    Farm.syncFarmers();

    let section = $('#cropBtns');
    let needsAppend = false;
    if (section.length === 0) {
      needsAppend = true;
      section = $('<div>').attr({ 'id': 'cropBtns', 'data-legend': _('crops:') }).css('opacity', 0);
    }

    // one button per crop, in crop table order; unfound ones show '?'
    for (const key of Object.keys(Farm.crops())) {
      let row = $('#crop_row_' + key.replace(/ /g, '-'), section);
      if (row.length === 0) {
        row = Farm.createCropRow(key).appendTo(section);
      }
      Farm.updateCropRow(key, row);
    }

    if (needsAppend && section.children().length > 0) {
      section.appendTo(Farm.panel).animate({ opacity: 1 }, 300, 'linear');
    }
  },

  createCropRow: key => {
    const row = $('<div>')
      .attr({ 'id': 'crop_row_' + key.replace(/ /g, '-'), 'key': key })
      .addClass('cropRow');

    new Button.Button({
      id: 'crop_button_' + key.replace(/ /g, '-'),
      text: '?',
      click: Farm.tend,
      width: '140px'
    }).attr('cropKey', key).appendTo(row);

    // the farmers tending this crop, drawn from the village's farmer pool
    const farmers = $('<div>').addClass('cropFarmers').appendTo(row);
    $('<div>').addClass('row_key').text(_('farmers')).appendTo(farmers);
    const val = $('<div>').addClass('row_val').appendTo(farmers);
    $('<span>').text(0).appendTo(val);
    $('<div>').addClass('upBtn').appendTo(val).click([1], Farm.increaseFarmer);
    $('<div>').addClass('dnBtn').appendTo(val).click([1], Farm.decreaseFarmer);
    $('<div>').addClass('upManyBtn').appendTo(val).click([10], Farm.increaseFarmer);
    $('<div>').addClass('dnManyBtn').appendTo(val).click([10], Farm.decreaseFarmer);

    $('<div>').addClass('clear').appendTo(row);

    return row;
  },

  updateCropRow: (key, row) => {
    const crop = Farm.crop(key);
    const button = $('.button', row);
    const unlocked = Farm.isUnlocked(key);

    if (!unlocked) {
      // nothing is given away about a crop whose seed hasn't turned up yet
      button.contents().filter(function () { return this.nodeType === 3; }).remove();
      button.prepend(document.createTextNode('?'));
      Button.setDisabled(button, true);
      Farm.setCropTooltip(button, []);
      $('.cropFarmers', row).hide();
      return;
    }

    $('.cropFarmers', row).show();
    $('.cropFarmers .row_val > span', row).text(Farm.farmersOn(key));
    $('.cropFarmers .upBtn, .cropFarmers .upManyBtn', row).toggleClass('disabled', Farm.freeFarmers() === 0);
    $('.cropFarmers .dnBtn, .cropFarmers .dnManyBtn', row).toggleClass('disabled', Farm.farmersOn(key) === 0);

    const growing = Farm.isGrowing(key);
    const label = growing ? _('harvest {0}', crop.name) : _('plant {0}', crop.name);
    button.contents().filter(function () { return this.nodeType === 3; }).remove();
    button.prepend(document.createTextNode(label));

    if (growing) {
      Farm.showGrowth(button, key, crop);
      Button.setDisabled(button, !Farm.isReady(key));
    } else {
      Farm.clearGrowth(button);
      Button.setDisabled(button, !Farm.hasFreeField());
    }

    Farm.setCropTooltip(button, [
      [ _('grows in'), _('{0}s', crop.growTime) ],
      [ _('yields'), _('{0} {1}', Farm.yieldFor(key), crop.name) ],
      [ _('restores'), _('{0} hp', crop.heal) ]
    ]);
  },

  setCropTooltip: (button, rows) => {
    let tooltip = $('.tooltip', button);
    if (tooltip.length === 0) {
      tooltip = $('<div>').addClass('tooltip bottom right').appendTo(button);
    }
    tooltip.empty();
    for (const [ key, value ] of rows) {
      $('<div>').addClass('row_key').text(key).appendTo(tooltip);
      $('<div>').addClass('row_val').text(value).appendTo(tooltip);
    }
  },

  // drives the cooldown bar from the planting time, not a running timer
  showGrowth: (button, key, crop) => {
    if (button.data('growing') === Farm.getPlots()[key].planted) {
      return;
    }
    button.data('growing', Farm.getPlots()[key].planted);

    const left = Farm.timeLeft(key);
    $('div.cooldown', button)
      .stop(true, true)
      .width((left / crop.growTime) * 100 + '%')
      .animate({ width: '0%' }, left * 1000, 'linear');
  },

  clearGrowth: button => {
    if (button.data('growing') === undefined) {
      return;
    }
    button.removeData('growing');
    $('div.cooldown', button).stop(true, true).width('0%');
  },

  updateStores: () => {
    let container = $('#farmStores');
    if (container.length === 0) {
      container = $('<div>').attr('id', 'farmStores').appendTo(Farm.panel);
    }

    // harvested veggies only; seeds get their own box below
    Farm.updateStoreBox(container, 'crops', _('crops'), key => {
      const num = $SM.get(`stores["${key}"]`, true);
      return num > 0 ? [ Farm.crop(key).name, num ] : null;
    });

    // lists found seeds with no count, like Fabricator's blueprints box
    Farm.updateStoreBox(container, 'seeds', _('seeds'), key => {
      const crop = Farm.crop(key);
      return Farm.isUnlocked(key) ? [ crop.seedName, '' ] : null;
    });
  },

  // rebuilds a box; rowFor returns [ label, value ] or null to skip a crop
  updateStoreBox: (container, id, legend, rowFor) => {
    let box = $('#' + id, container);
    let needsAppend = false;
    if (box.length === 0) {
      needsAppend = true;
      box = $('<div>').attr({ 'id': id, 'data-legend': legend }).addClass('farmStoreBox').css('opacity', 0);
    }

    let previous = null;
    for (const key of Object.keys(Farm.crops())) {
      const rowId = id + '_row_' + key.replace(/ /g, '-');
      let row = $('#' + rowId, box);
      const content = rowFor(key);

      if (content === null) {
        row.remove();
        continue;
      }
      if (row.length === 0) {
        row = $('<div>').attr('id', rowId).addClass('storeRow');
        $('<div>').addClass('row_key').appendTo(row);
        $('<div>').addClass('row_val').appendTo(row);
        $('<div>').addClass('clear').appendTo(row);
        if (previous === null) {
          row.prependTo(box);
        } else {
          row.insertAfter(previous);
        }
      }
      $('.row_key', row).text(content[0]);
      $('.row_val', row).text(content[1]);
      previous = row;
    }

    if (box.children().length === 0) {
      box.remove();
    } else if (needsAppend) {
      box.appendTo(container).animate({ opacity: 1 }, 300, 'linear');
    }
  },

  updateView: () => {
    Farm.updateFields();
    Farm.updateCrops();
    Farm.updateStores();
  },

  // redraws growth timers and notifies when a crop is ready
  tick: () => {
    for (const key of Object.keys(Farm.getPlots())) {
      const row = $('#crop_row_' + key.replace(/ /g, '-'));
      if (row.length > 0) {
        Farm.updateCropRow(key, row);
      }

      const token = key + ':' + Farm.getPlots()[key].planted;
      if (Farm.isReady(key) && !Farm._notified[token]) {
        Farm._notified[token] = true;
        const crop = Farm.crop(key);
        if (crop) {
          Notifications.notify(Farm, _('the {0} is ready to pick', crop.name));
        }
      }
    }
  },

  setTitle: () => {
    if (Engine.activeModule === Farm) {
      document.title = _('The Farm');
    }
  },

  /* Lifecycle ------------------------------------------------------------- */

  init: options => {
    if (Farm._initialized) {
      return;
    }
    Farm._initialized = true;

    Farm.options = $.extend(Farm.options, options);

    if (!$SM.get('features.location.farm')) {
      $SM.set('features.location.farm', true);
    }
    // the farm comes with its first field
    if (!$SM.get('game.farm.fields')) {
      $SM.set('game.farm.fields', 1);
    }

    // the farm sits just after the path, ahead of the ship tabs
    const nextPanel = $('#fabricatorPanel').length > 0 ? $('#fabricatorPanel') :
                      $('#shipPanel').length > 0 ? $('#shipPanel') : null;

    Farm.tab = Header.addLocation(_('The Farm'), 'farm', Farm);
    Farm.panel = $('<div>').attr('id', 'farmPanel').addClass('location');

    if (nextPanel === null) {
      Farm.panel.appendTo('div#locationSlider');
    } else {
      Farm.panel.insertBefore(nextPanel);
      Farm.tab.insertBefore('#location_' + nextPanel.attr('id').replace('Panel', ''));
    }

    // re-anchor on whatever's open, since inserting the panel shifts the slider
    if (Engine.activeModule) {
      const open = $('.location').index(Engine.activeModule.panel) * 700;
      $('#locationSlider').css('left', -open + 'px');
      $('#storesContainer').css('right', -open + 'px');
    }

    // anything already ripe when the page loaded has had its moment
    const plots = Farm.getPlots();
    for (const key of Object.keys(plots)) {
      if (Farm.isReady(key)) {
        Farm._notified[key + ':' + plots[key].planted] = true;
      }
    }

    $.Dispatch('stateUpdate').subscribe(Farm.handleStateUpdates);
    Farm._tickInterval = Engine.setInterval(Farm.tick, Farm._TICK);

    Engine.updateSlider();
    Farm.updateView();
  },

  onArrival: () => {
    Farm.setTitle();
    Farm.updateView();

    if (!$SM.get('game.farm.seen')) {
      Notifications.notify(Farm, _('rows of turned earth, waiting on something to put in them'));
      $SM.set('game.farm.seen', true);
    }
    AudioEngine.playBackgroundMusic(AudioLibrary.MUSIC_TINY_VILLAGE);
  },

  handleStateUpdates: e => {
    if (e.category === 'stores' ||
        e.stateName.indexOf('game.farm') === 0 ||
        e.stateName.indexOf('game.seeds') === 0 ||
        e.stateName.indexOf('game.workers') === 0 ||
        e.stateName.indexOf('game.population') === 0) {
      Farm.updateView();
    }
  }

};
