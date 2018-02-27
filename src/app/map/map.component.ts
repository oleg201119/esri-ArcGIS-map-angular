import { Component, OnInit } from '@angular/core';
import { EsriLoaderService } from 'angular2-esri-loader';
import * as esri from "esri";



@Component({
  selector: 'esri-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css']
})
export class MapComponent implements OnInit {

  public map: any;
  private mapDiv: string = 'mapDiv';
  private picBaseUrl: string = "https://static.arcgis.com/images/Symbols/Shapes/";

  private highlightPinGraphic: any;

  // sample data
  data: any = {
    points: [
      { longitude: -76.509722, latitude: 3.434 },
      { longitude: -76.519722, latitude: 3.431 },
      { longitude: -76.529722, latitude: 3.434 }      
    ]
  };

  // cluster
  cluster_data: any = {
    points: [
      { longitude: -76.519121, latitude: 3.442 },
      { longitude: -76.518222, latitude: 3.444 },
      { longitude: -76.519323, latitude: 3.443 },
      { longitude: -76.517424, latitude: 3.445 },
      { longitude: -76.519525, latitude: 3.446 },
      { longitude: -76.526621, latitude: 3.447 },
      { longitude: -76.529722, latitude: 3.448 },
      { longitude: -76.527823, latitude: 3.449 },
      { longitude: -76.509721, latitude: 3.449 },
      { longitude: -76.507722, latitude: 3.448 }
    ]
  };

  private cluster_options: any ={};

  constructor(private esriLoader: EsriLoaderService) { }

  ngOnInit() {
    
    // only load the ArcGIS API for JavaScript when this component is loaded
    return this.esriLoader.load({
      // use a specific version of the JSAPI
      url: 'https://js.arcgis.com/3.23/'
    }).then(() => {
      // load the needed Map and MapView modules from the JSAPI
      this.esriLoader.loadModules([
        'esri/map',
        'esri/geometry/Point',
        'esri/geometry/webMercatorUtils',
        'esri/symbols/PictureMarkerSymbol',
        'esri/symbols/CartographicLineSymbol',
        'esri/symbols/SimpleMarkerSymbol',
        'esri/symbols/TextSymbol',
        'esri/renderers/ClassBreaksRenderer',
        'esri/geometry/Polyline',
        'esri/InfoTemplate',
        'esri/InfoWindowBase',
        'esri/layers/GraphicsLayer',
        'esri/graphic',
        'esri/Color',
        'esri/dijit/PopupTemplate',
        'esri/SpatialReference'
      ]).then(([
        Map,
        Point,
        webMercatorUtils,
        PictureMarkerSymbol,
        CartographicLineSymbol,
        SimpleMarkerSymbol,
        TextSymbol,
        ClassBreaksRenderer,
        Polyline,
        InfoTemplate,
        InfoWindowBase,
        GraphicsLayer,
        Graphic,
        Color,
        PopupTemplate,
        SpatialReference
      ]) => {

        class ClusterLayer extends GraphicsLayer {
          
          init(options) {
            
            this._clusterTolerance = options.distance || 50;
            this._clusterData = options.data || [];
            this._clusters = [];
            this._clusterLabelColor = options.labelColor || "#000";
            
            // labelOffset can be zero so handle it differently
            this._clusterLabelOffset = (options.hasOwnProperty("labelOffset")) ? options.labelOffset : -5;
            
            // graphics that represent a single point
            this._singles = []; // populated when a graphic is clicked
            this._showSingles = options.hasOwnProperty("showSingles") ? options.showSingles : true;
            
            // symbol for single graphics
            this._singleSym = options.singleSymbol || new SimpleMarkerSymbol("circle", 6, null, new Color("#888"));
            this._singleTemplate = options.singleTemplate || new PopupTemplate({ "title": "", "description": "{*}" });
            this._maxSingles = options.maxSingles || 1000;
      
            this._webmap = options.hasOwnProperty("webmap") ? options.webmap : false;
      
            this._sr = options.spatialReference || new SpatialReference({ "wkid": 102100 });
      
            this._zoomEnd = null;
          }

          _setMap(map, surface) {
            
            // calculate and set the initial resolution
            this._clusterResolution = map.extent.getWidth() / map.width; // probably a bad default...
            this._clusterGraphics();

            map.on('ZoomEnd', () => {
              
              // update resolution
              this._clusterResolution = this._map.extent.getWidth() / this._map.width;
              this.clear();
              this._clusterGraphics();              
            });

            var div = super._setMap(map, surface);
            return div;
          }

          _unsetMap() {
            
            super._unsetMap();            
          }

          add(p) {

            // if passed a graphic, use the GraphicsLayer's add method
            super.add(p);            
          }

          clear() {
            // Summary:  Remove all clusters and data points.
            super.clear();
            this._clusters.length = 0;
          }

          clearSingles(singles) {
            // Summary:  Remove graphics that represent individual data points.
            var s = singles || this._singles;
            
            s.forEach((g) => {
              this.remove(g);
            });
            this._singles.length = 0;
          }

          onClick(e) {
            // remove any previously showing single features
            this.clearSingles(this._singles);
      
            // find single graphics that make up the cluster that was clicked
            // would be nice to use filter but performance tanks with large arrays in IE
            var singles = [];
            for ( var i = 0, il = this._clusterData.length; i < il; i++) {
              if ( e.graphic.attributes.clusterId == this._clusterData[i].attributes.clusterId ) {
                singles.push(this._clusterData[i]);
              }
            }
            if ( singles.length > this._maxSingles ) {
              alert("Sorry, that cluster contains more than " + this._maxSingles + " points. Zoom in for more detail.");
              return;
            } else {
              // stop the click from bubbling to the map
              e.stopPropagation();
              this._map.infoWindow.show(e.graphic.geometry);
              this._addSingles(singles);
            }
          }

          // internal methods 
          _clusterGraphics() {
            
            // first time through, loop through the points
            for ( var j = 0, jl = this._clusterData.length; j < jl; j++ ) {
              // see if the current feature should be added to a cluster
              var point = this._clusterData[j];
              var clustered = false;
              var numClusters = this._clusters.length;
              for ( var i = 0; i < this._clusters.length; i++ ) {
                var c = this._clusters[i];
                if ( this._clusterTest(point, c) ) {
                  this._clusterAddPoint(point, c);
                  clustered = true;
                  break;
                }
              }

              if ( ! clustered ) {
                this._clusterCreate(point);
              }
            }
            this._showAllClusters();
          }

          _clusterTest(p, cluster) {
            var distance = (
              Math.sqrt(
                Math.pow((cluster.x - p.x), 2) + Math.pow((cluster.y - p.y), 2)
              ) / this._clusterResolution
            );
            return (distance <= this._clusterTolerance);
          }

          _clusterAddPoint(p, cluster) {
            
            // average in the new point to the cluster geometry
            var count, x, y;
            count = cluster.attributes.clusterCount;
            x = (p.x + (cluster.x * count)) / (count + 1);
            y = (p.y + (cluster.y * count)) / (count + 1);
            cluster.x = x;
            cluster.y = y;
      
            // build an extent that includes all points in a cluster
            // extents are for debug/testing only...not used by the layer
            if ( p.x < cluster.attributes.extent[0] ) {
              cluster.attributes.extent[0] = p.x;
            } else if ( p.x > cluster.attributes.extent[2] ) {
              cluster.attributes.extent[2] = p.x;
            }
            if ( p.y < cluster.attributes.extent[1] ) {
              cluster.attributes.extent[1] = p.y;
            } else if ( p.y > cluster.attributes.extent[3] ) {
              cluster.attributes.extent[3] = p.y;
            }
      
            // increment the count
            cluster.attributes.clusterCount++;
            // attributes might not exist
            if ( ! p.hasOwnProperty("attributes") ) {
              p.attributes = {};
            }
            // give the graphic a cluster id
            p.attributes.clusterId = cluster.attributes.clusterId;
          }

          _clusterCreate(p) {

            var clusterId = this._clusters.length + 1;
            // console.log("cluster create, id is: ", clusterId);
            // p.attributes might be undefined
            if ( ! p.attributes ) {
              p.attributes = {};
            }
            p.attributes.clusterId = clusterId;
            // create the cluster
            var cluster = { 
              "x": p.x,
              "y": p.y,
              "attributes" : {
                "clusterCount": 1,
                "clusterId": clusterId,
                "extent": [ p.x, p.y, p.x, p.y ]
              }
            };
            this._clusters.push(cluster);
          }

          _showAllClusters() {

            for ( var i = 0, il = this._clusters.length; i < il; i++ ) {
              var c = this._clusters[i];
              this._showCluster(c);
            }
          }

          _showCluster(c) {

            var point = new Point(c.x, c.y, this._sr);
            this.add(
              new Graphic(
                point, 
                null, 
                c.attributes
              )
            );
            // code below is used to not label clusters with a single point
            if ( c.attributes.clusterCount == 1 ) {
              return;
            }
      
            // show number of points in the cluster
            var label = new TextSymbol(c.attributes.clusterCount.toString())
              .setColor(new Color(this._clusterLabelColor))
              .setOffset(0, this._clusterLabelOffset);
            this.add(
              new Graphic(
                point,
                label,
                c.attributes
              )
            );
          }

          _addSingles(singles) {

            // add single graphics to the map
            singles.forEach((p) => {
              var g = new Graphic(
                new Point(p.x, p.y, this._sr),
                this._singleSym,
                p.attributes,
                this._singleTemplate
              );
              this._singles.push(g);
              if ( this._showSingles ) {
                this.add(g);
              }
            });
            this._map.infoWindow.setFeatures(this._singles);
          }

          _updateClusterGeometry(c) {

            console.log('_updateClusterGeometry');

            // find the cluster graphic
            var cg = this.graphics.filter((g) => {
              return ! g.symbol &&
                     g.attributes.clusterId == c.attributes.clusterId;
            });
            if ( cg.length == 1 ) {
              cg[0].geometry.update(c.x, c.y);
            } else {
              console.log("didn't find exactly one cluster geometry to update: ", cg);
            }
          }

          _updateLabel(c) {

            console.log('_updateLabel');

            // find the existing label
            var label = this.graphics.filter((g) => {
              return g.symbol && 
                     g.symbol.constructor.name == "esri.symbol.TextSymbol" &&
                     g.attributes.clusterId == c.attributes.clusterId;
            });

            if ( label.length == 1 ) {
              // console.log("update label...found: ", label);
              this.remove(label[0]);
              var newLabel = new TextSymbol(c.attributes.clusterCount)
                .setColor(new Color(this._clusterLabelColor))
                .setOffset(0, this._clusterLabelOffset);
              this.add(
                new Graphic(
                  new Point(c.x, c.y, this._sr),
                  newLabel,
                  c.attributes
                )
              );
              // console.log("updated the label");
            } else {
              console.log("didn't find exactly one label: ", label);
            }
          }

        };


        // create map
        var mapProperties: esri.MapOptions = {
          basemap: 'hybrid',
          center: [-76.519722, 3.44],
          zoom: 14
        };
        
        this.map = new Map(this.mapDiv, mapProperties);

        // create pin symbol
        var greenPinSymbol = new PictureMarkerSymbol(this.picBaseUrl + "GreenPin1LargeB.png", 64, 64).setOffset(0, 28);
        var redPinSymbol = new PictureMarkerSymbol(this.picBaseUrl + "RedPin1LargeB.png", 64, 64).setOffset(0, 28);

        // map load
        this.map.on('load', () => {
          
          // draw lines between the pin symbols
          drawLines();

          // draw pin symbols
          drawPins();

          // event handlers
          this.map.graphics.on("mouse-over", (evt) => {
            if (evt.graphic.geometry.type == 'point') {
              this.map.setMapCursor("pointer");
            }          
          });

          this.map.graphics.on("mouse-out", (evt) => {
            if (evt.graphic.geometry.type == 'point') {
              this.map.setMapCursor("default");
            }            
          });

          this.map.graphics.on("click", (evt) => {
            if (evt.graphic.geometry.type == 'point') {

              // restore old hightlight pin
              if (this.highlightPinGraphic) {
                setDefaultPinSymbol(this.highlightPinGraphic);
              }              

              // set new highlight pin
              this.highlightPinGraphic = evt.graphic;
              setHighlightPinSymbol(evt.graphic);              
            }            
          });

          this.map.infoWindow.on("hide", (evt) => {            
            if (this.highlightPinGraphic) {
              setDefaultPinSymbol(this.highlightPinGraphic);
              this.highlightPinGraphic = null;
            }
          })
          
          // clusters
          var clusterInfo = {
            data: null
          };

          var wgs = new SpatialReference({
            "wkid": 4326
          });

          clusterInfo.data = this.cluster_data.points.map((p) => {
            
            var latlng = new  Point(parseFloat(p.longitude), parseFloat(p.latitude), wgs);
            var webMercator = webMercatorUtils.geographicToWebMercator(latlng);

            var attributes = {
              "longitude": p.longitude,
              "latitude": p.latitude
            };

            return {
              "x": webMercator.x,
              "y": webMercator.y,
              "attributes": attributes
            };
          });

          var popupTemplate = new PopupTemplate({
            "title": "",
            "fieldInfos": [{
              "fieldName": "longitude",
              visible: true
            }, {
              "fieldName": "latitude",
              visible: true
            }]
          });

          var clusterLayer = new ClusterLayer();
          clusterLayer.init({
            "data": clusterInfo.data,
            "distance": 100,
            "id": "clusters",
            "labelColor": "#fff",
            "labelOffset": 23,
            "resolution": this.map.extent.getWidth() / this.map.width,
            "singleColor": "#888",
            "singleTemplate": popupTemplate      
          });

          var defaultSym = new SimpleMarkerSymbol().setSize(4);
          var renderer = new ClassBreaksRenderer(defaultSym, "clusterCount");

          var picBaseUrl = "https://static.arcgis.com/images/Symbols/Shapes/";
          var blue = new PictureMarkerSymbol(picBaseUrl + "BluePin1LargeB.png", 64, 64).setOffset(0, 28);
          var orange = new PictureMarkerSymbol(picBaseUrl + "OrangePin1LargeB.png", 64, 64).setOffset(0, 28);
          var red = new PictureMarkerSymbol(picBaseUrl + "RedPin1LargeB.png", 64, 64).setOffset(0, 28);
          renderer.addBreak(0, 1, blue);
          renderer.addBreak(1, 3, orange);
          renderer.addBreak(3, 100, red);

          clusterLayer.setRenderer(renderer);
          this.map.addLayer(clusterLayer);

        });

        var drawLines = () => {
          var lineSymbol = new CartographicLineSymbol(
            CartographicLineSymbol.STYLE_SOLID,
            new Color([0,255,0]), 4, 
            CartographicLineSymbol.CAP_ROUND,
            CartographicLineSymbol.JOIN_MITER, 2
          );

          var singlePathPolyline = new Polyline([
            [this.data.points[0].longitude, this.data.points[0].latitude], 
            [this.data.points[1].longitude, this.data.points[1].latitude],
            [this.data.points[2].longitude, this.data.points[2].latitude]
          ]);

          // create graphic
          var graphic = new Graphic(singlePathPolyline, lineSymbol);

          // add graphic to map
          this.map.graphics.add(graphic);
        }

        var drawPins = () => {
          for (let point of this.data.points) {

            // attribute
            var attr = {"Long": point.longitude, "Lat": point.latitude};

            // info template
            var infoTemplate = new InfoTemplate({
              title: 'Info Window',
              content: `<p>Longitude: ${point.longitude} </p><p>Latitude: ${point.latitude}</p><a href="/info?long=${point.longitude}&lat=${point.latitude}">info link</a>`
            });
  
            // point
            var pt = new Point(point);

            // create graphic
            var graphic = new Graphic(pt, redPinSymbol, attr, infoTemplate);

            // add graphic to map
            this.map.graphics.add(graphic);            
          }

          this.highlightPinGraphic = null;
        }

        var setHighlightPinSymbol = (graphic)  => {          
          graphic.setSymbol(greenPinSymbol);          
        }

        var setDefaultPinSymbol = (graphic) => {
          graphic.setSymbol(redPinSymbol);
        }
       

      });
    });
  }
}
