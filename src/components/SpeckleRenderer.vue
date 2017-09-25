<template>
  <div>
    <div id='render-window' ref='mycanvas'>
    </div>
    <div v-show='showInfoBox' id='info-box' class='object-info' ref='infobox'>
      <md-whiteframe md-elevation="3" style='background-color:white' v-show='expandInfoBox' class='expanded-info-box'>
        <tree-view :data='propertiesToDisplay' :options='{ maxDepth: 3, rootObjectKey: selectedObjectsProperties.hash } '></tree-view>
      </md-whiteframe>
      <md-button class="md-icon-button md-raised md-accent md-dense expand-button" style='color:white !important;' @click.native='zoomToObject'>
        <md-icon>
        zoom_in
        </md-icon>
      </md-button>
      <md-button class="md-icon-button md-raised xxxmd-primary md-dense expand-button" style='background-color:white;color:black !important;' @click.native='expandInfoBox=!expandInfoBox'>
        <md-icon v-if='!isMobile'>
        {{ expandInfoBox ? 'keyboard_arrow_left' : 'keyboard_arrow_right' }}
        </md-icon>
        <md-icon v-else>
        {{ expandInfoBox ? 'close' : 'info_outline' }}
        </md-icon>
      </md-button>
    </div>
    <transition name="fade">
      <div v-if='showBlur' class='blur'></div>
    </transition>
  </div>
</template>

<script>
import * as THREE           from 'three'
import OrbitControlsDef     from 'three-orbit-controls'
import TWEEN                from 'tween.js'
import debounce             from 'debounce'

import Converter            from '../converter/converter'

import TCDef  from 'three-transform-controls'
import _ from 'lodash'
// var TransformControls = require('three-transform-controls')(THREE)

export default {
  name: 'SpeckleRenderer',
  computed: {
    isMobile() {
      return this.$store.getters.isMobile
    },
    allObjects() {
      return this.$store.getters.allObjects
    },
    layerMaterials() {
      return this.$store.getters.allLayerMaterials
    },
    propertiesToDisplay() {
      return this.selectedObjectsProperties.properties 
    }
  },
  data() {
    return {
      selectedObjectsProperties:[ { hash: null, properties: {} } ],
      hoveredObject: '',
      showInfoBox: false,
      expandInfoBox: false,
      isRotatingStuff: false,
      enableDo: false, 
      showBlur: false
    }
  },
  watch: {
    'isRotatingStuff': {
      handler( newValue ) {
        if( newValue )
          this.showInfoBox = false
          this.expandInfoBox = false
      }
    }
  },
  methods: {
    update( ) {
      if( this.updateInProgress ) return console.warn( 'Scene update was already in progress, cancelling.' )
      this.updateInProgress = true 
      for( let myObject of this.allObjects ) {
        
        let sceneObj = this.scene.children.find( obj => { return obj.name === myObject.streamId + '::' + myObject._id } )
        
        let layer = this.layerMaterials.find( lmat => { return lmat.guid === myObject.layerGuid && lmat.streamId === myObject.streamId })
        
        if( !sceneObj ) {
          this.$http.get( window.SpkAppConfig.restApi + '/objects/' + myObject._id + '?omit=base64' )
          .then( result => {
            if( ! Converter.hasOwnProperty( result.data.speckleObject.type )) throw new Error('Cannot convert this object: ' + result.data.speckleObject.type + ','+ myObject._id )
            Converter[ result.data.speckleObject.type ]( { obj: result.data.speckleObject, layer: layer, camera: this.camera }, ( err, threeObj )=>{
                threeObj.hash = result.data.speckleObject.hash
                threeObj.streamId = myObject.streamId
                threeObj.layerGuid = myObject.layerGuid
                threeObj.visible = layer.visible
                threeObj.isCurrent = true
                threeObj.spkProperties = result.data.speckleObject.properties
                threeObj.name = myObject.streamId + '::' + result.data.speckleObject._id
                threeObj._id = myObject._id
                this.scene.add( threeObj )
            } )
          })
          .catch( err=> {
            // console.error( err )
          } )
        } else {
          if( sceneObj.visible === false ) {
            sceneObj.visible = true
            sceneObj.isCurrent = true
            sceneObj.spkProperties = myObject.properties
          }
        }
      }

      for( let myObject of this.scene.children ) {
        if( myObject.hasOwnProperty( '_id' ) ) {
          let found = this.allObjects.find( o => { return o._id === myObject._id && o.streamId === myObject.streamId } )
          if( !found ) {
            myObject.isCurrent = false
            myObject.visible = false
          }
          if( this.scene.children.length > 4242 ) // arbitrary number, needs battle testing 
            this.scene.remove( myObject )
        }
      }
      this.updateInProgress = false
    },

    render( ) {
      TWEEN.update() 
      this.controls.update()
      this.animationId = requestAnimationFrame( this.render )
      this.renderer.render( this.scene, this.camera )
      if( ++this.frameSkipper == 20 ) {        
        if( this.oldQuaternion._x === this.camera.quaternion._x && this.oldQuaternion._y === this.camera.quaternion._y && this.oldQuaternion._z === this.camera.quaternion._z && this.oldQuaternion._w === this.camera.quaternion._w) {
          this.isRotatingStuff = false
        }
        else {
          this.deselectObjects( )
          this.isRotatingStuff = true
        }
        this.frameSkipper = 0
      }
      this.oldQuaternion = new THREE.Quaternion().copy( this.camera.quaternion )
      window.camLoc = {
        position: [ this.camera.position.x, this.camera.position.y, this.camera.position.z ],
        rotation: [ this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z ],
        target: [ this.controls.target.x, this.controls.target.y, this.controls.target.z ]
      }
    },

    resizeCanvas () {
      this.camera.aspect = this.$refs.mycanvas.clientWidth / this.$refs.mycanvas.clientHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize( this.$refs.mycanvas.clientWidth, this.$refs.mycanvas.clientHeight )
    },

    deselectObjects( ) {
    },

    canvasHovered( event ) {
    },
    canvasClickedEvent( event ) {
    },

    addPointController( args ){ 
      this.ctrl = TCDef( THREE )
      var greatGizmo = new this.ctrl( this.camera, this.renderer.domElement )
      var geometry = new THREE.SphereGeometry( 10, 5, 5 );
      var material = new THREE.MeshNormalMaterial( )
      greatGizmo.addEventListener( 'change', () => {
        let myObj = this.scene.children.find( obj => { return obj.name === 'gizmo-trigger-' + args.Guid } )
        let myGizmo = this.scene.children.find( obj => { return obj.name === 'gizmo-' + args.Guid } )
        let pos = myObj.position
        
        // constrain!!!
        if( pos.x > args.MaxX ) {
          myObj.position.setX( args.MaxX )
          myGizmo.position.setX( args.MaxX )
        }
        if( pos.x < args.MinX) {
          myObj.position.setX( args.MinX )
          myGizmo.position.setX( args.MinX )
        }
        if( pos.y > args.MaxY ) {
          myObj.position.setY( args.MaxY )
          myGizmo.position.setY( args.MaxY )
        }
        if( pos.y < args.MinY) {
          myObj.position.setY( args.MinY )
          myGizmo.position.setY( args.MinY )
        }
        if( pos.z > args.MaxZ ) {
          myObj.position.setZ( args.MaxZ )
          myGizmo.position.setZ( args.MaxZ )
        }
        if( pos.z < args.MinZ) {
          myObj.position.setZ( args.MinZ) 
          myGizmo.position.setZ( args.MinZ) 
        }
      } );

      greatGizmo.addEventListener( 'mouseUp', ( what ) => {
        let myObj = this.scene.children.find( obj => { return obj.name === 'gizmo-trigger-' + args.Guid } )
        let pos = myObj.position
        this.sendControllerUpdate( { Guid: args.Guid, position: { X: pos.x, Y: pos.y, Z: pos.z }})
      })
      greatGizmo.name = 'gizmo-' + args.Guid
      var mesh = new THREE.Mesh( geometry, material );
      mesh.name = 'gizmo-trigger-' + args.Guid
      mesh.translateX( args.X )
      mesh.translateY( args.Y )
      mesh.translateZ( args.Z )

      this.scene.add( mesh );
      greatGizmo.attach( mesh );
      this.scene.add( greatGizmo );
    },

    sendControllerUpdate: _.debounce( ( args ) => {
      bus.$emit( 'pointcontroller-changed', args )
    }, 100 ),

    zoomExtents() {
      let ge = new THREE.Geometry()

    },

    zoomToObject( ) {
      let myObject = this.scene.children.find( ch => { return ch.hash === this.selectedObjectsProperties.hash } )

      if( ! myObject ) return console.warn('no object selected')
      myObject.geometry.computeBoundingSphere()
      let bsphere = myObject.geometry.boundingSphere

      this.zoomTo( bsphere )
    },

    zoomTo( bsphere ) {
      let r = bsphere.radius
      let offset = r / Math.tan( Math.PI / 180.0 * this.controls.object.fov * 0.5 )
      let vector = new THREE.Vector3( 0, 0, 1 )
      let dir = vector.applyQuaternion( this.controls.object.quaternion );
      let newPos = new THREE.Vector3( )
      dir.multiplyScalar( offset * 1.25 )
      newPos.addVectors( bsphere.center, dir )
      this.setCamera( {
        position: [ newPos.x, newPos.y, newPos.z ],
        rotation: [ this.camera.rotation.x, this.camera.rotation.y, this.camera.rotation.z ],
        target: [ bsphere.center.x, bsphere.center.y, bsphere.center.z ] 
      }, 200 )
    },

    setCamera( where, time ) {
      let self = this
      let duration = time ? time : 350
      //position
      new TWEEN.Tween( self.camera.position ).to( { x: where.position[ 0 ], y: where.position[ 1 ], z: where.position[ 2 ] }, duration ).easing( TWEEN.Easing.Quadratic.InOut ).start()
      // rotation
      new TWEEN.Tween( self.camera.rotation ).to( { x: where.rotation[ 0 ], y: where.rotation[ 1 ], z: where.rotation[ 2 ] }, duration ).easing( TWEEN.Easing.Quadratic.InOut ).start()
      // controls center
      new TWEEN.Tween( self.controls.target ).to( { x: where.target[ 0 ], y: where.target[ 1 ], z: where.target[ 2 ] }, duration ).onUpdate(()=>{ 
          self.controls.update();
          if( this.x === where.target[ 0 ] )
            console.log('camera finished stuff')
        }).easing( TWEEN.Easing.Quadratic.InOut ).start()
    }
  },
  mounted() {
    this.oldQuaternion = null
    this.frameSkipper = 0
    this.animationId = null
    this.selectionBoxes = []
    this.hoveredObjects = []

    this.updateInProgress = false

    this.hoverMaterial = new THREE.MeshPhongMaterial( { color: new THREE.Color('#FFFF66'), specular: new THREE.Color('#FFECB3'), shininess: 0, side: THREE.DoubleSide, transparent: true, opacity: 1 } ) 

    this.renderer = new THREE.WebGLRenderer( { alpha: true, antialias: true } )
    this.renderer.setSize( this.$refs.mycanvas.clientWidth, this.$refs.mycanvas.clientHeight )
    this.renderer.setClearColor(new THREE.Color('#FFFFFF'), 0)
    this.$refs.mycanvas.appendChild( this.renderer.domElement )

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera( 75, this.$refs.mycanvas.clientWidth / this.$refs.mycanvas.clientHeight, 1, 10000 );
    this.camera.up.set( 0, 0, 1 )
    this.camera.position.z = 1000
    this.camera.isCurrent = true
    this.camera.name = 'my super camera'
    this.oldQuaternion = new THREE.Quaternion().copy( this.camera.quaternion )

    this.OrbitControls = OrbitControlsDef( THREE )
    this.controls = new this.OrbitControls( this.camera, this.renderer.domElement)
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.33;
    this.render() 
    window.addEventListener( 'resize', this.resizeCanvas )

    let hemiLight = new THREE.HemisphereLight( 0xffffff, 0xffffff, 1 );
    hemiLight.color = new THREE.Color('#FFFFFF')
    hemiLight.groundColor = new THREE.Color('#959595')
    hemiLight.position.set( 0, 500, 0 );
    hemiLight.isCurrent = true
    hemiLight.name = 'world lighting'
    this.scene.add( hemiLight );

    let flashlight = new THREE.PointLight( new THREE.Color('#FFFFFF'), 0.32, 0, 1 )
    flashlight.name = 'camera light'
    this.scene.add( this.camera )
    this.camera.add( flashlight )

    this.raycaster = new THREE.Raycaster()

    this.$refs.mycanvas.onmousedown = this.canvasClickedEvent
  
    document.onkeydown = ( event ) => {
      if( event.keyCode !== 27 ) return
      this.deselectObjects( )
      this.showInfoBox = false
      this.expandInfoBox = false
    }

    window.THREE = THREE
    window.scene = this.scene

    bus.$on( 'renderer-update',  debounce( this.update, 300 ) )
    bus.$on( 'renderer-setview',  this.setCamera )

    bus.$on( 'renderer-add-blur', () => { 
      this.showBlur = true 
    })
    bus.$on( 'renderer-remove-blur', () => { 
      this.showBlur = false 
    })


    bus.$on( 'renderer-pop', () => {
      this.$refs.mycanvas.classList.toggle('pop')
      this.showInfoBox = false
      this.expandInfoBox = false
    })
    bus.$on( 'renderer-unpop', () => {
      this.$refs.mycanvas.classList.toggle('pop')
    })

    bus.$on( 'renderer-add-pointcontroller', this.addPointController )
  }
}
</script>

<style scoped>
.blur{
  position: absolute;
  top:0;left:0;
  width:100%;
  height: 100%;
  opacity: 0.90;
  z-index: 100;
  pointer-events: none;
  background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAANUlEQVQoU2NkwAO6urr+M+KSB0mWlZUxYlUAkwRpxlCALImhAF0SRQE2SbgCXJJgBfgkQQoAGz0epkcUVV0AAAAASUVORK5CYII=) repeat;

}
#render-window {
  position: absolute;
  top:0;left:0;
  width:100%;
  height: 100%;
  /*z-index: 10;*/
  transition: all .2s ease;
}

#render-window.pop{
  top: -15%;
}

.object-info {
  position: fixed;
  top:10px;right:10px;
  z-index: 10;
  user-select: none;
}

.expand-button{
  z-index: 42;
  margin: 0px !important;
}

.expanded-info-box {
  padding: 8px 50px 10px 50px;
  position: absolute;
  top: 0;
  left: 35px;
  max-width: 350px;
  max-height: 300px;
  border-top-left-radius: 16px;
  border-bottom-left-radius: 16px;  
  border-top-right-radius: 16px;
  border-bottom-right-radius: 16px;
  user-select: auto;
  z-index: 40;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto; 
}
@media ( max-width: 768px ) {
  .expanded-info-box{
    position: fixed;
    top: auto;
    bottom: 50px;
    left: 2%;
    width:96%;
    max-width: 96%;
    height: 30%;
    background-color: white;
    z-index: 44;
    overflow-x: auto;
  }
}
.tree-view-wrapper {
  font-family: auto;
  overflow: hidden !important;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 1s
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0
}
</style>