import LocationConflation from '@rapideditor/location-conflation';
import whichPolygon from 'which-polygon';
import calcArea from '@mapbox/geojson-area';

import { AbstractSystem } from './AbstractSystem';

const LOCO = new LocationConflation();    // shared instance of a location-conflation resolver


/**
 * `LocationSystem` maintains an internal index of all the boundaries/geofences.
 * It's used by presets, community index, background imagery, to know where in the world these things are valid.
 * These geofences should be defined by `locationSet` objects:
 *
 * let locationSet = {
 *   include: [ Array of locations ],
 *   exclude: [ Array of locations ]
 * };
 *
 * For more info see the location-conflation and country-coder projects, see:
 * https://github.com/ideditor/location-conflation
 * https://github.com/ideditor/country-coder
 *
 * Events available:
 *   `locationchange`  Fires on any change in the location index
 */
export class LocationSystem extends AbstractSystem {

/**
 * @typedef {Object} LocationSet
 * @property {Array.<string>} include a list of location names
 */

  /**
   * @constructor
   * @param  context  Global shared application context
   */
  constructor(context) {
    super(context);
    this.id = 'locations';
    this.dependencies = new Set();

    this._wp = null;                        // A which-polygon index
    this._resolved = new Map();             // Map (id -> GeoJSON feature)
    this._knownLocationSets = new Map();    // Map (locationSetID -> Number area)
    this._locationIncludedIn = new Map();   // Map (locationID -> Set(locationSetID) )
    this._locationExcludedIn = new Map();   // Map (locationID -> Set(locationSetID) )

    // BLOCKED REGIONS
    this._blocks = [{
      locationSet: { include: ['Q7835', 'ua'] },
      text: 'Editing has been blocked in this region per request of the OSM Ukrainian community.',
      url: 'https://wiki.openstreetmap.org/wiki/Russian%E2%80%93Ukrainian_war'
    }];

    const blockedFeatures = this._blocks.map(block => {
      // Pre-resolve the blocked region locationSets into GeoJSON features
      this._resolveLocationSet(block);
      // Merge the info about the block into the GeoJSON's properties
      let feature = this._resolved.get(block.locationSetID);
      Object.assign(feature.properties, block);
      return feature;
    });

    // Make a separate which-polygon just for these (static, very few features, very frequent lookups)
    this._wpblocks = whichPolygon({ type: 'FeatureCollection', features: blockedFeatures });

    // pre-resolve the worldwide locationSet
    const world = { locationSet: { include: ['Q2'] } };
    this._resolveLocationSet(world);
    this._rebuildIndex();
  }


  /**
   * initAsync
   * Called after all core objects have been constructed.
   * @return {Promise} Promise resolved when this component has completed initialization
   */
  initAsync() {
    for (const id of this.dependencies) {
      if (!this.context.systems[id]) {
        return Promise.reject(`Cannot init:  ${this.id} requires ${id}`);
      }
    }
    return Promise.resolve();
  }


  /**
   * startAsync
   * Called after all core objects have been initialized.
   * @return {Promise} Promise resolved when this component has completed startup
   */
  startAsync() {
    this._started = true;
    return Promise.resolve();
  }


  /**
   * resetAsync
   * Called after completing an edit session to reset any internal state
   * @return {Promise} Promise resolved when this component has completed resetting
   */
  resetAsync() {
    return Promise.resolve();
  }


  /**
   * _validateLocationSet
   * Pass an Object with a `locationSet` property.
   * Validates the `locationSet` and sets a `locationSetID` property on the object.
   * To avoid so much computation we only resolve the include and exclude regions, but not the locationSet itself.
   *
   * Use `_resolveLocationSet()` instead if you need to resolve geojson of locationSet, for example to render it.
   * Note: You need to call `_rebuildIndex()` after you're all finished validating the locationSets.
   *
   * @param  `obj`  Object to check, it should have `locationSet` property
   */
  _validateLocationSet(obj) {
    if (obj.locationSetID) return;  // work was done already

    try {
      let locationSet = obj.locationSet;
      if (!locationSet) {
        throw new Error('object missing locationSet property');
      }
      if (!locationSet.include) {      // missing `include`, default to worldwide include
        locationSet.include = ['Q2'];  // https://github.com/openstreetmap/iD/pull/8305#discussion_r662344647
      }

      // Validate the locationSet only
      // Resolve the include/excludes
      const locationSetID = LOCO.validateLocationSet(locationSet).id;
      obj.locationSetID = locationSetID;
      if (this._knownLocationSets.has(locationSetID)) return;   // seen one like this before

      let area = 0;

      // Resolve and index the 'includes'
      (locationSet.include || []).forEach(location => {
        const locationID = LOCO.validateLocation(location).id;
        let geojson = this._resolved.get(locationID);

        if (!geojson) {    // first time seeing a location like this
          geojson = LOCO.resolveLocation(location).feature;     // resolve to GeoJSON
          this._resolved.set(locationID, geojson);
        }
        area += geojson.properties.area;

        let s = this._locationIncludedIn.get(locationID);
        if (!s) {
          s = new Set();
          this._locationIncludedIn.set(locationID, s);
        }
        s.add(locationSetID);
      });

      // Resolve and index the 'excludes'
      (locationSet.exclude || []).forEach(location => {
        const locationID = LOCO.validateLocation(location).id;
        let geojson = this._resolved.get(locationID);

        if (!geojson) {    // first time seeing a location like this
          geojson = LOCO.resolveLocation(location).feature;     // resolve to GeoJSON
          this._resolved.set(locationID, geojson);
        }
        area -= geojson.properties.area;

        let s = this._locationExcludedIn.get(locationID);
        if (!s) {
          s = new Set();
          this._locationExcludedIn.set(locationID, s);
        }
        s.add(locationSetID);
      });

      this._knownLocationSets.set(locationSetID, area);

    } catch (err) {
      obj.locationSet = { include: ['Q2'] };  // default worldwide
      obj.locationSetID = '+[Q2]';
    }
  }


  /**
   * _resolveLocationSet
   * Does everything that `_validateLocationSet()` does, but then "resolves" the locationSet into GeoJSON.
   * This step is a bit more computationally expensive, so really only needed if you intend to render the shape.
   *
   * Note: You need to call `_rebuildIndex()` after you're all finished validating the locationSets.
   *
   * @param  `obj`  Object to check, it should have `locationSet` property
   */
  _resolveLocationSet(obj) {
    this._validateLocationSet(obj);

    if (this._resolved.has(obj.locationSetID)) return;  // work was done already

    try {
      const result = LOCO.resolveLocationSet(obj.locationSet);
      const locationSetID = result.id;
      obj.locationSetID = locationSetID;

      if (!result.feature.geometry.coordinates.length || !result.feature.properties.area) {
        throw new Error(`locationSet ${locationSetID} resolves to an empty feature.`);
      }

      let geojson = JSON.parse(JSON.stringify(result.feature));   // deep clone
      geojson.id = locationSetID;      // Important: always use the locationSet `id` (`+[Q30]`), not the feature `id` (`Q30`)
      geojson.properties.id = locationSetID;
      this._resolved.set(locationSetID, geojson);

    } catch (err) {
      obj.locationSet = { include: ['Q2'] };  // default worldwide
      obj.locationSetID = '+[Q2]';
    }
  }


  /**
   * _rebuildIndex
   * Rebuilds the whichPolygon index with whatever features have been resolved into GeoJSON.
   */
  _rebuildIndex() {
    this._wp = whichPolygon({ features: [...this._resolved.values()] });
    this.emit('locationchange');
  }


  /**
   * mergeCustomGeoJSON
   * Accepts a FeatureCollection-like object containing custom locations
   * Each feature must have a filename-like `id`, for example: `something.geojson`
   * {
   *   "type": "FeatureCollection"
   *   "features": [
   *     {
   *       "type": "Feature",
   *       "id": "philly_metro.geojson",
   *       "properties": { … },
   *       "geometry": { … }
   *     }
   *   ]
   * }
   *
   * @param  `fc`  FeatureCollection-like Object containing custom locations
   */
  mergeCustomGeoJSON(fc) {
    if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) return;

    fc.features.forEach(feature => {
      feature.properties = feature.properties || {};
      let props = feature.properties;

      // Get `id` from either `id` or `properties`
      let id = feature.id || props.id;
      if (!id || !/^\S+\.geojson$/i.test(id)) return;

      // Ensure `id` exists and is lowercase
      id = id.toLowerCase();
      feature.id = id;
      props.id = id;

      // Ensure `area` property exists
      if (!props.area) {
        const area = calcArea.geometry(feature.geometry) / 1e6;  // m² to km²
        props.area = Number(area.toFixed(2));
      }

      LOCO._cache[id] = feature;   // insert directly into LocationConflations internal cache
    });
  }


  /**
   * mergeLocationSets
   * Accepts an Array of Objects containing `locationSet` properties:
   * [
   *  { id: 'preset1', locationSet: {…} },
   *  { id: 'preset2', locationSet: {…} },
   *  …
   * ]
   * After validating, the Objects will be decorated with a `locationSetID` property:
   * [
   *  { id: 'preset1', locationSet: {…}, locationSetID: '+[Q2]' },
   *  { id: 'preset2', locationSet: {…}, locationSetID: '+[Q30]' },
   *  …
   * ]
   *
   * @param  `objects`  Objects to check - they should have `locationSet` property
   * @return  Promise resolved true (this function used to be slow/async, now it's faster and sync)
   */
  mergeLocationSets(objects) {
    if (!Array.isArray(objects)) return Promise.reject('nothing to do');

    objects.forEach(obj => this._validateLocationSet(obj));
    this._rebuildIndex();
    return Promise.resolve(objects);
  }


  /**
   * locationSetID
   * Returns a locationSetID for a given locationSet (fallback to `+[Q2]`, world)
   * (The locationSet doesn't necessarily need to be resolved to compute its `id`)
   *
   * @param  `locationSet`  A {LocationSet} Object, e.g. `{ include: ['us'] }`
   * @return  String locationSetID, e.g. `+[Q30]`
   */
  locationSetID(locationSet) {
    let locationSetID;
    try {
      locationSetID = LOCO.validateLocationSet(locationSet).id;
    } catch (err) {
      locationSetID = '+[Q2]';  // the world
    }
    return locationSetID;
  }


  /**
   * feature
   * Returns the resolved GeoJSON feature for a given locationSetID (fallback to 'world')
   * A GeoJSON feature:
   * {
   *   type: 'Feature',
   *   id: '+[Q30]',
   *   properties: { id: '+[Q30]', area: 21817019.17, … },
   *   geometry: { … }
   * }
   *
   * @param  `locationSetID`  String identifier, e.g. `+[Q30]`
   * @return  GeoJSON object (fallback to world)
   */
  feature(locationSetID = '+[Q2]') {
 // should we actually resolve it if it hasn't been?
 // this shouldn't matter, as it's currently only used to render the blocked regions
    const feature = this._resolved.get(locationSetID);
    return feature || this._resolved.get('+[Q2]');
  }


  /**
   * locationSetsAt
   * Find all the locationSets valid at the given location.
   * Results include the area (in km²) to facilitate sorting.
   *
   * Object of locationSetIDs to areas (in km²)
   * {
   *   "+[Q2]": 511207893.3958111,
   *   "+[Q30]": 21817019.17,
   *   "+[new_jersey.geojson]": 22390.77,
   *   …
   * }
   *
   * @param  `loc`  `[lon,lat]` location to query, e.g. `[-74.4813, 40.7967]`
   * @return  Object of locationSetIDs valid at given location
   */
  locationSetsAt(loc) {
    let result = {};

    const hits = this._wp(loc, true) || [];
    const thiz = this;

    // locationSets
    hits.forEach(prop => {
      if (prop.id[0] !== '+') return;  // skip - it's a location
      const locationSetID = prop.id;
      const area = thiz._knownLocationSets.get(locationSetID);
      if (area) {
        result[locationSetID] = area;
      }
    });

    // locations included
    hits.forEach(prop => {
      if (prop.id[0] === '+') return;   // skip - it's a locationset
      const locationID = prop.id;
      const included = thiz._locationIncludedIn.get(locationID);
      (included || []).forEach(locationSetID => {
        const area = thiz._knownLocationSets.get(locationSetID);
        if (area) {
          result[locationSetID] = area;
        }
      });
    });

    // locations excluded
    hits.forEach(prop => {
      if (prop.id[0] === '+') return;   // skip - it's a locationset
      const locationID = prop.id;
      const excluded = thiz._locationExcludedIn.get(locationID);
      (excluded || []).forEach(locationSetID => {
        delete result[locationSetID];
      });
    });

    return result;
  }


  /**
   * blocksAt
   * Returns any blocks that exist for the given location
   *
   * @param  `loc`  `[lon,lat]` location to query, e.g. `[-74.4813, 40.7967]`
   * @return  Array of block Objects (empty array if none)
   */
  blocksAt(loc) {
    if (!this._blocks.length) return [];
    return this._wpblocks(loc, true) || [];
  }


  // Direct access to the location-conflation resolver
  loco() {
    return LOCO;
  }

  // Direct access to the "blocks" which-polygon index
  wpblocks() {
    return this._wpblocks;
  }
}
