import { utilArrayIdentical } from '@rapid-sdk/util';

import { actionChangePreset } from '../actions';
import { actionNoop } from '../actions/noop';
import { KeyOperationBehavior } from '../behaviors/KeyOperationBehavior';

let _wasSelectedIDs = [];
let _wasHighwayPresetIDs = [];
let _wasCrosswalkPresetIDs = [];


export function operationCycleHighwayTag(context, selectedIDs) {
  // Allow cycling through lines that match these presets
  const allowHighwayPresetRegex = [
    /^highway\/(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|track)/,
    /^line$/
  ];

  const defaultHighwayPresetIDs = [
    'highway/residential',
    'highway/service',
    'highway/track',
    'highway/unclassified',
    'highway/tertiary',
    'line',
  ];

  // same selection as before?
  const isSameSelection = utilArrayIdentical(selectedIDs, _wasSelectedIDs);
  const highwayPresetIDs = new Set(isSameSelection ? _wasHighwayPresetIDs : defaultHighwayPresetIDs);
  const presetSystem = context.systems.presets;

  // Gather current entities allowed to be cycled
  const entities = selectedIDs
    .map(entityID => context.hasEntity(entityID))
    .filter(entity => {
      if (entity?.type !== 'way') return false;

      const preset = presetSystem.match(entity, context.graph());
      if (allowHighwayPresetRegex.some(regex => regex.test(preset.id))) {
        if (!highwayPresetIDs.has(preset.id)) highwayPresetIDs.add(preset.id);  // make sure we can cycle back to the original preset
        return true;
      } else {
        return false;
      }
    });

  _wasSelectedIDs = selectedIDs.slice();  // copy
  _wasHighwayPresetIDs = Array.from(highwayPresetIDs);  // copy


  let operation = function() {
    if (!entities.length) return;

    // If this is the same selection as before, and the previous edit was also a cycle-tags,
    // skip this `perform`, then all tag updates will be coalesced into the previous edit.
    const annotation = operation.annotation();
    if (!isSameSelection || context.systems.edits.undoAnnotation() !== annotation) {
      // Start with a no-op edit that will be replaced by all the tag updates we end up doing.
      context.perform(actionNoop(), annotation);
    }

    // Pick the next preset..
    const currHighwayPresetIDs = Array.from(highwayPresetIDs);
    const currPreset = presetSystem.match(entities[0], context.graph());
    const index = currPreset ? currHighwayPresetIDs.indexOf(currPreset.id) : -1;
    const newHighwayPresetID = currHighwayPresetIDs[(index + 1) % currHighwayPresetIDs.length];
    const newPreset = presetSystem.item(newHighwayPresetID);

    // Update all selected highways...
    for (const entity of entities) {
      const oldPreset = presetSystem.match(entity, context.graph());
      const action = actionChangePreset(entity.id, oldPreset, newPreset, true /* skip field defaults */);
      context.replace(action, annotation);
    }

    context.enter('select-osm', { selectedIDs: selectedIDs });  // reselect
  };


  operation.available = function() {
    return entities.length > 0;
  };


  operation.disabled = function() {
    return false;
  };


  operation.tooltip = function() {
    const disabledReason = operation.disabled();
    return disabledReason ?
      context.t(`operations.cycle_highway_tag.${disabledReason}`) :
      context.t('operations.cycle_highway_tag.description');
  };


  operation.annotation = function() {
    return context.t('operations.cycle_highway_tag.annotation');
  };


  operation.id = 'cycle_highway_tag';
  operation.keys = [ '⇧' + context.t('operations.cycle_highway_tag.key') ];
  operation.title = context.t('operations.cycle_highway_tag.title');
  operation.behavior = new KeyOperationBehavior(context, operation);

  return operation;
}

export function operationCycleCrosswalkTag(context, selectedIDs) {
  // Allow cycling through lines that match these crosswalk presets
  const allowCrossingPresetRegex = [
    /^crossing\/(unmarked|marked|marked:zebra|marked:lines|marked:dashes|marked:ladder|marked:dots|marked:ladder:skewed)/,
  ];

  const defaultCrossingPresetIDs = [
    'crossing/unmarked;crossing:markings=no',
    'crossing/marked;crossing:markings=yes',
    'crossing/marked;crossing:markings=zebra',
    'crossing/marked;crossing:markings=lines',
    'crossing/marked;crossing:markings=ladder',
    'crossing/marked;crossing:markings=dashes',
    'crossing/marked;crossing:markings=dots',
    'crossing/marked;crossing:markings=ladder:skewed',
  ];

  const isSameSelection = utilArrayIdentical(selectedIDs, _wasSelectedIDs);
  const crossingPresetIDs = new Set(isSameSelection ? _wasCrosswalkPresetIDs : defaultCrossingPresetIDs);
  const presetSystem = context.systems.presets;

  const entities = selectedIDs
    .map(entityID => context.hasEntity(entityID))
    .filter(entity => {
      if (entity?.type !== 'way') return false;

      const preset = presetSystem.match(entity, context.graph());
      if (allowCrossingPresetRegex.some(regex => regex.test(preset.id))) {
        if (!crossingPresetIDs.has(preset.id)) crossingPresetIDs.add(preset.id);  // make sure we can cycle back to the original preset
        return true;
      } else {
        return false;
      }
    });

  _wasSelectedIDs = selectedIDs.slice();
  _wasCrosswalkPresetIDs = Array.from(crossingPresetIDs);

  let operation = function() {
    if (!entities.length) return;

    // If this is the same selection as before, and the previous edit was also a cycle-tags,
    // skip this `perform`, then all tag updates will be coalesced into the previous edit.
    const annotation = operation.annotation();
    if (!isSameSelection || context.systems.edits.undoAnnotation() !== annotation) {
      // Start with a no-op edit that will be replaced by all the tag updates we end up doing.
      context.perform(actionNoop(), annotation);
    }

    // Pick the next preset..
    const currCrossingPresetIDs = Array.from(crossingPresetIDs);
    const currPreset = presetSystem.match(entities[0], context.graph());
    const index = currPreset ? currCrossingPresetIDs.indexOf(currPreset.id) : -1;
    const newCrossingPresetID = currCrossingPresetIDs[(index + 1) % currCrossingPresetIDs.length];
    const newPreset = presetSystem.item(newCrossingPresetID);

    // Update all selected highways...
    for (const entity of entities) {
      const oldPreset = presetSystem.match(entity, context.graph());
      const action = actionChangePreset(entity.id, oldPreset, newPreset, true /* skip field defaults */);
      context.replace(action, annotation);
    }

    context.enter('select-osm', { selectedIDs: selectedIDs });  // reselect
  };


  operation.available = function() {
    return entities.length > 0;
  };


  operation.disabled = function() {
    return false;
  };


  operation.tooltip = function() {
    const disabledReason = operation.disabled();
    return disabledReason ?
      context.t(`operations.cycle_crosswalk_tag.${disabledReason}`) :
      context.t('operations.cycle_crosswalk_tag.description');
  };


  operation.annotation = function() {
    return context.t('operations.cycle_crosswalk_tag.annotation');
  };


  operation.id = 'cycle_crosswalk_tag';
  operation.keys = [ '⇧' + context.t('operations.cycle_crosswalk_tag.key') ];
  operation.title = context.t('operations.cycle_crosswalk_tag.title');
  operation.behavior = new KeyOperationBehavior(context, operation);

  return operation;
}
