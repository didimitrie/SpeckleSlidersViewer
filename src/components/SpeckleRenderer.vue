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
      <md-button class="md-icon-button md-raised md-primary md-dense expand-button" style='color:white !important;' @click.native='expandInfoBox=!expandInfoBox'>
        <md-icon>
        {{expandInfoBox ? 'keyboard_arrow_left' : 'keyboard_arrow_right' }}
        </md-icon>
      </md-button>
    </div>
  </div>
</template>

<script>
import * as THREE           from 'three'
import OrbitControlsDef     from 'three-orbit-controls'
import TWEEN                from 'tween.js'
import debounce             from 'debounce'

import Converter            from '../converter/converter'

export default {
  name: 'SpeckleRenderer',
  computed: {
    allObjects() {
      return this.$store.getters.allObjects
    },
    layerMaterials() {
      return this.$store.getters.allLayerMaterials
    },
    propertiesToDisplay() {
      return this.selectedObjectsProperties.properties 
      // return this.selectedObjectsProperties.properties ? this.selectedObjectsProperties.properties : { properties: 'none'}
    }
  },
  data() {
    return {
      selectedObjectsProperties:[ { hash: null, properties: {} } ],
      hoveredObject: '',
      showInfoBox: false,
      expandInfoBox: false,
      isRotatingStuff: false
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
        let sceneObj = this.scene.children.find( obj => { return obj.hash === myObject.hash && obj.streamId === myObject.streamId } )
        if( !sceneObj ) {
          if( ! Converter.hasOwnProperty( myObject.type ) ) 
            console.warn( 'Renderer: non convertable object: ' + myObject.type )
          else {
            let layer = this.layerMaterials.find( lmat => { return lmat.guid === myObject.layerGuid && lmat.streamId === myObject.streamId })
            
            if( Converter.heavyTypes.indexOf( myObject.type ) < 0 ) {
              Converter[ myObject.type ]( { obj: myObject, layer: layer, camera: this.camera } , ( err, threeObj ) => {
                threeObj.hash = myObject.hash
                threeObj.streamId = myObject.streamId
                threeObj.layerGuid = myObject.layerGuid
                threeObj.visible = layer.visible
                threeObj.isCurrent = true
                threeObj.spkProperties = myObject.properties
                threeObj.name = myObject.streamId + '::' + myObject.hash
                this.scene.add( threeObj )
              })
            } else {
              this.$http.get( window.SpkAppConfig.serverDetails.restApi + '/geometry/' + myObject.hash )
              .then( res => { 
                Converter[ res.data.data.type ]( { obj: res.data.data, layer: layer, camera: this.camera }, ( err, threeObj ) => {
                  threeObj.hash = myObject.hash
                  threeObj.streamId = myObject.streamId
                  threeObj.layerGuid = myObject.layerGuid
                  threeObj.visible = layer.visible
                  threeObj.isCurrent = true
                  threeObj.spkProperties = myObject.properties
                  threeObj.name = myObject.streamId + '::' + myObject.hash
                  this.scene.add( threeObj )
                })
              })
              .catch( err => { 
                console.error( err )
              })
            }
          }
        } else {
          if( sceneObj.visible === false ) {
            sceneObj.visible = true
            sceneObj.isCurrent = true
            sceneObj.spkProperties = myObject.properties
          }
        }
      }

      for( let myObject of this.scene.children ) {
        if( myObject.hasOwnProperty( 'hash' ) ) {
          let found = this.allObjects.find( o => { return o.hash === myObject.hash && o.streamId === myObject.streamId } )
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
      this.animationId = requestAnimationFrame( this.render )
      this.renderer.render( this.scene, this.camera )

      if( ++this.frameSkipper == 30 ) {        
        if( this.oldQuaternion._x === this.camera.quaternion._x && this.oldQuaternion._y === this.camera.quaternion._y && this.oldQuaternion._z === this.camera.quaternion._z && this.oldQuaternion._w === this.camera.quaternion._w) {
          // console.log('stopped')
          this.isRotatingStuff = false
        }
        else {
          // console.log('rotating')
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
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize( window.innerWidth, window.innerHeight )
    },
    canvasHovered( event ) {
      if( this.isRotatingStuff ) return
      this.selectionBoxes.forEach( box => scene.remove( box ) )
      this.hoveredObjects.forEach( myObject => {
        let layer = this.layerMaterials.find( lmat => { return lmat.guid === myObject.layerGuid && lmat.streamId === myObject.streamId } )
        myObject.material = layer.threeMeshMaterial
      })
      this.hoveredObject = ''
      this.selectionBoxes = []

      // preselect object
      let mouse = new THREE.Vector2( ( event.clientX / window.innerWidth ) * 2 - 1, - ( event.clientY / window.innerHeight ) * 2 + 1 )
      this.raycaster.setFromCamera( mouse, this.camera )

      let intersects  = this.raycaster.intersectObjects( scene.children )
      // console.log( intersects )
      if( intersects.length <= 0 ) {
        this.showInfoBox = false
        this.expandInfoBox = false
        return
      }

      let selectedObject = null
      intersects.reverse().forEach( obj => {
        if( obj.object.material.visible ) selectedObject = obj.object
      })

      if( !selectedObject ) {
        this.showInfoBox = false
        this.expandInfoBox = false
        return
      }
      selectedObject.material = this.hoverMaterial
      this.hoveredObjects.push( selectedObject )
      this.hoveredObject = selectedObject.hash

      this.selectedObjectsProperties = {
        hash: selectedObject.hash,
        streamId: selectedObject.streamId,
        properties: selectedObject.spkProperties 
      }
    },
    canvasClickedEvent( event ) {
      if( event.which === 3 ) {
        this.showInfoBox = false
        this.expandInfoBox = false
        return
      }
      this.canvasHovered( event )
      if( this.hoveredObject != '' ) {
        this.showInfoBox = true
        this.$refs.infobox.style.left = event.clientX - 20 + 'px'
        this.$refs.infobox.style.top = event.clientY - 20  + 'px'
      } else {
        this.showInfoBox = false
        this.expandInfoBox = false
      }
    },
    zoomToObject( ) {
      let myObject = this.scene.children.find( ch => { return ch.hash === this.selectedObjectsProperties.hash } )

      if( ! myObject ) return console.warn('no object selected')
      myObject.geometry.computeBoundingSphere()
      let bsphere = myObject.geometry.boundingSphere
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
      // this.controls.object.position.set( newPos.x, newPos.y, newPos.z )
      // this.controls.target.set( bsphere.center.x, bsphere.center.y, bsphere.center.z )
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
    this.renderer.setSize( window.innerWidth, window.innerHeight )
    this.renderer.setClearColor(new THREE.Color('#FFFFFF'), 0)
    this.$refs.mycanvas.appendChild( this.renderer.domElement )

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 1, 10000 );
    this.camera.position.z = 1000;
    this.camera.up.set( 0, 0, 1 )
    this.camera.isCurrent = true
    this.camera.name = 'my super camera'
    this.oldQuaternion = new THREE.Quaternion().copy( this.camera.quaternion )

    this.OrbitControls = OrbitControlsDef( THREE )
    this.controls = new this.OrbitControls( this.camera, this.renderer.domElement)
    
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
    // this.$refs.mycanvas.onmousemove = debounce( this.canvasHovered, 200 )
    // this.$refs.mycanvas.onmousemove = this.canvasHovered
    this.$refs.mycanvas.onmousedown = this.canvasClickedEvent
    document.onkeydown = ( event ) => {
      if( event.keyCode !== 27 ) return
      this.selectionBoxes.forEach( box => scene.remove( box ) )
      this.hoveredObjects.forEach( myObject => {
        let layer = this.layerMaterials.find( lmat => { return lmat.guid === myObject.layerGuid && lmat.streamId === myObject.streamId } )
        myObject.material = layer.threeMeshMaterial
      })
      this.hoveredObject = ''
      this.selectionBoxes = []
      this.showInfoBox = false
      this.expandInfoBox = false
    }

    window.THREE = THREE
    window.scene = this.scene

    bus.$on( 'renderer-update',  debounce( this.update, 300 ) )
    bus.$on( 'renderer-setview',  this.setCamera )

    console.log( this.controls )
  }
}
</script>

<style scoped>
#render-window {
  position: fixed;
  top:0;left:0;
  width:100%;
  height: 100%;
  z-index: 10;
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

.tree-view-wrapper {
  font-family: auto;
  overflow: hidden !important;
}
</style>