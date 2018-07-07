// FIXME keep cluster cache by resolution ?
// FIXME distance not respected because of the centroid

goog.provide('ol.source.ClusterExt');

goog.require('ol');
goog.require('ol.asserts');
goog.require('ol.Feature');
goog.require('ol.coordinate');
goog.require('ol.events.EventType');
goog.require('ol.extent');
goog.require('ol.geom.Point');
goog.require('ol.source.Vector');


/**
 * @classdesc
 * Layer source to cluster vector data. Works out of the box with point
 * geometries. For other geometry types, or if not all geometries should be
 * considered for clustering, a custom `geometryFunction` can be defined.
 *
 * @constructor
 * @param {olx.source.ClusterOptions} options Constructor options.
 * @extends {ol.source.Vector}
 * @api
 */
ol.source.ClusterExt = function (options) {
  ol.source.Vector.call(this, {
    attributions: options.attributions,
    extent: options.extent,
    logo: options.logo,
    projection: options.projection,
    wrapX: options.wrapX
  });

  /**
   * @type {number|undefined}
   * @protected
   */
  this.resolution = undefined;

  /**
   * @type {number}
   * @protected
   */
  this.distance = options.distance !== undefined ? options.distance : 20;

  /**
   * @type {Array.<ol.Feature>}
   * @protected
   */
  this.features = [];

  /**
   * @param {ol.Feature} feature Feature.
   * @return {ol.geom.Point} Cluster calculation point.
   * @protected
   */
  this.geometryFunction = options.geometryFunction || function (feature) {
    var geometry = /** @type {ol.geom.Point} */ (feature.getGeometry());
    ol.asserts.assert(geometry instanceof ol.geom.Point,
      10); // The default `geometryFunction` can only handle `ol.geom.Point` geometries
    return geometry;
  };

  /**
   * @type {ol.source.Vector}
   * @protected
   */
  this.source = options.source;

  this.source.on(ol.events.EventType.CHANGE,
    ol.source.ClusterExt.prototype.refresh, this);
  this.types = {}; //cluster children types
  this.clusterTitleVisible = options.clusterTitleVisible !== undefined ? !!options.clusterTitleVisible : true;
  this.singleTitleVisible = !!options.singleTitleVisible;
  this.directionVisible = !!options.directionVisible;
  this.features_ = [];
  this.extent = undefined;
  this.resolution = undefined;
  this.tempFeatures = undefined;
};
ol.inherits(ol.source.ClusterExt, ol.source.Vector);

/**
 * Get the distance in pixels between clusters.
 * @return {number} Distance.
 * @api
 */
ol.source.ClusterExt.prototype.getDistance = function () {
  return this.distance;
};

/**
 * Get a reference to the wrapped source.
 * @return {ol.source.Vector} Source.
 * @api
 */
ol.source.ClusterExt.prototype.getSource = function () {
  return this.source;
};

/**
 * @inheritDoc
 */
ol.source.ClusterExt.prototype.loadFeatures = function (extent, resolution,
  projection) {
  this.source.loadFeatures(extent, resolution, projection);
  if (!this.extent || !ol.extent.equals(this.extent, extent)) {
    this.clear();
    this.resolution = resolution;
    this.tempFeatures = null;
    this.extent = extent;
    this.cluster();
    this.addFeatures(this.features_);
  }
};

/**
 * Set the distance in pixels between clusters.
 * @param {number} distance The distance in pixels.
 * @api
 */
ol.source.ClusterExt.prototype.setDistance = function (distance) {
  this.distance = distance;
  this.refresh();
};

/**
 * set gun camera direction visible
 * @param {boolean} flag 
 */
ol.source.ClusterExt.prototype.setDirectionVisible = function (flag) {
  this.directionVisible = !!flag;
}

/**
 * set single feature title visible
 * @param {boolean} flag 
 */
ol.source.ClusterExt.prototype.setSingleTitleVisible = function (flag) {
  this.singleTitleVisible = !!flag;
}

/**
 * add small circle point to cluster point
 * @param {Array.<ol.Feature>} features 
 */
ol.source.ClusterExt.prototype.addTempPoints = function (features) {
  if (this.tempFeatures && this.tempFeatures instanceof Array) {
    for (var i = 0, len = this.tempFeatures.length; i < len; i++) {
      var element = this.tempFeatures[i];
      this.removeFeature(element);
    }
  }
  this.tempFeatures = features;
  this.addFeatures(features);
}

/**
 * set cluster child type visible
 * @param {string} type 
 * @param {boolean} visible 
 */
ol.source.ClusterExt.prototype.setClusterTypeVisible = function (type, visible) {
  if (type) {
    this.types[type] = !!visible;
  }
}

/**
 * handle the source changing
 * @override
 */
ol.source.ClusterExt.prototype.refresh = function () {
  this.clear();
  this.tempFeatures = null;
  this.cluster();
  this.addFeatures(this.features_);
  ol.source.Vector.prototype.refresh.call(this);
};

/**
 * @protected
 */
ol.source.ClusterExt.prototype.cluster = function () {
  if (this.resolution === undefined || !this.extent) {
    return;
  }
  this.features_.length = 0;
  var extent = ol.extent.createEmpty();
  var mapDistance = this.distance * this.resolution;
  var features = this.source.getFeaturesInExtent(this.extent);

  /**
   * @type {!Object.<string, boolean>}
   */
  var clustered = {};

  for (var i = 0, ii = features.length; i < ii; i++) {
    var feature = features[i];
    if (!(ol.getUid(feature).toString() in clustered)) {
      var geometry = this.geometryFunction(feature);
      if (geometry) {
        var coordinates = geometry.getCoordinates();
        ol.extent.createOrUpdateFromCoordinate(coordinates, extent);
        ol.extent.buffer(extent, mapDistance, extent);
        var type = feature.get("type") && feature.get("type").toString(); //聚合分组类型 
        if (!this.types[type]) continue;
        var neighbors = this.source.getFeaturesInExtent(extent);
        neighbors = neighbors.filter(function (neighbor) {
          var uid = ol.getUid(neighbor).toString();
          var neighborType = neighbor.get("type");
          if (!(uid in clustered) && (type === neighborType)) {
            clustered[uid] = true;
            return true;
          } else {
            return false;
          }
        });
        this.createCluster(neighbors, type);
      }
    }
  }
};


/**
 * @param {Array.<ol.Feature>} features Features
 * @param {string} type type
 * @protected
 */
ol.source.ClusterExt.prototype.createCluster = function (features, type) {
  var centroid = [0, 0];
  for (var i = features.length - 1; i >= 0; --i) {
    var geometry = this.geometryFunction(features[i]);
    if (geometry) {
      ol.coordinate.add(centroid, geometry.getCoordinates());
    } else {
      features.splice(i, 1);
    }
  }
  ol.coordinate.scale(centroid, 1 / features.length);

  var feature = new ol.Feature(new ol.geom.Point(centroid));
  feature.set("type", type);
  if (features.length > 1) {
    feature.set("featureType", "cluster");
    feature.set('count', features.length);
    feature.set("features", features);
    this.features_.push(feature);
    if (this.clusterTitleVisible) {
      var clusterTitle = new ol.Feature(new ol.geom.Point(centroid));
      clusterTitle.set("featureType", "clusterTitle");
      clusterTitle.set("type", type);
      clusterTitle.set('count', features.length);
      this.features_.push(clusterTitle);
    }
  } else {
    var markerModel = features[0].get("data");
    feature.set("featureType", "single");
    feature.set("data", markerModel);
    this.features_.push(feature);
    if (this.singleTitleVisible && markerModel.name) {
      var singleTitle = new ol.Feature(new ol.geom.Point(centroid));
      singleTitle.set("featureType", "singleTitle");
      singleTitle.set("type", type);
      singleTitle.set("name", markerModel.name);
      this.features_.push(singleTitle);
    }
    if (this.directionVisible && markerModel && markerModel.rotation !== undefined) {
      var clusterShadow = new ol.Feature(new ol.geom.Point(centroid));
      clusterShadow.set("featureType", "shadow");
      clusterShadow.set("type", type);
      clusterShadow.set("rotation", markerModel.rotation);
      this.features_.push(clusterShadow);
    }
  }
};
