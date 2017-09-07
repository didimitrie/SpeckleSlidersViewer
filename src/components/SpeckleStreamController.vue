<template>
  <div>
    <md-card class="receiver">  
    <md-card-header>
      <div class="md-title"><!-- <small>Customise:</small> --> <strong>{{ spkreceiver.name }}</strong></div>
    </md-card-header>
    
    <md-progress md-indeterminate v-show='showProgressBar' style='margin-bottom:10px;margin-top:0px;' class='md-warn'></md-progress>
      <md-card-content>
        <div v-if='controllers.length == 0'>
          Loading...
        </div>
        <div>
          <div v-for='controller in sortedControllers' class='controller'>
            <div class='slider-controller' v-if='controller.Type==="Slider"'>
              <!-- <vue-slider v-model="controller.Value" :min='controller.Min' :max='controller.Max' :piecewise='false' :interval='controller.Step' :lazy='true' :formatter="controller.Name + ': {value}'" ></vue-slider> -->
              <vue-slider v-model="controller.Value" :min='controller.Min' :max='controller.Max' :piecewise='false' :interval='controller.Step' :lazy='true' :tooltipStyle='tooltipStyle' :dot-size='24' :slider-style='sliderStyle' :process-style='processStyle'></vue-slider>
              <div class='xxxtext-center md-caption'>{{controller.Name}}</div>
            </div>
            <div class='text-controller' v-if='controller.Type==="TextPanel"'>
              <md-input-container class='text-center'>
                <label>{{controller.Name}}</label>
                <md-textarea v-model="controller.Value"></md-textarea>
              </md-input-container>
            </div>
          </div>
        </div>
        <div v-if='showLayers'>
          <speckle-receiver-layer-custom v-for='layer in layers' :key='layer.guid' :spklayer='layer' :streamid='spkreceiver.streamId'></speckle-receiver-layer-custom>
        </div>
        <div v-if='showColorPickerLayers'>
          <speckle-receiver-layer v-for='layer in layers' :key='layer.guid' :spklayer='layer' :streamid='spkreceiver.streamId'></speckle-receiver-layer>
        </div>

      </md-card-content>
    </md-card>
    <md-card class="receiver" md-with-hover>
      <md-card-content>  
          <div style="xxxtext-align:center">
          <div v-for='outputThing in sortedOutputs'>
            <span :class="outputThing.IsPrincipal ? 'md-title' : 'caption'">{{outputThing.Name}}: <strong>{{outputThing.Value}}</strong><i>{{outputThing.Unit}}</i></span>
            <!-- <span v-if='!outputThing.IsPrincipal' class="md-subheading">Display 2</span> -->
          </div>
        </div>
        <br>
        <div class="xxxtext-center">
          <md-button class='md-accent md-raised text'>Next</md-button>
        </div>
      </md-card-content>
    </md-card>
  </div>
</template>
<script>
import ReceiverClient               from '../receiver/ClientReceiver'
import VueSlider                    from 'vue-slider-component'
import SpeckleReceiverLayerCustom   from './SpeckleReceiverLayerCM.vue'
import SpeckleReceiverLayer         from './SpeckleReceiverLayer.vue'

import debounce                     from 'debounce'
import _                            from 'lodash'

export default {
  name: 'SpeckleReceiver',
  components: {
    VueSlider,
    SpeckleReceiverLayer,
    SpeckleReceiverLayerCustom
  },
  props: ['spkreceiver'],
  computed: {
    username() {
      return this.$store.getters.user.name
    },
    layers() {
      return this.spkreceiver.layers
    },
    sortedControllers() {
      return this.controllers.sort( (a, b) => { 
        return a.OrderIndex - b.OrderIndex
      }) 
    },
    sortedOutputs() {
      return this.outs.sort( (a, b) => { 
        return a.OrderIndex - b.OrderIndex
      }) 
    },
    sliders() {
      return this.controllers.filter( c => c.Type === 'Slider' )
    }
  },
  data () {
    return {
      showLayers: false,
      showColorPickerLayers: false,
      showProgressBar: true,
      objLoadProgress: 100,
      expanded: true, 
      expired: false,
      controllers: [],
      responses: [],
      showControllers: false,
      outs: [],
      debounceCount: 0,
      tooltipStyle: {
         "backgroundColor": "#666",
          "borderColor": "#666",
          "fontSize": "12px",
          "position": "relative",
          "top": "5px"
      },
      sliderStyle: {
        "backgroundColor": "#333333"
      },
      processStyle: {
        "backgroundColor" : "#000000"
      }
    }
  },
  watch: {
    'controllers':{
      handler( values ) {
        // prevents init requests etc. 
        if(this.debounceCount >= 5) { 
          let args = {
            controllers: this.controllers, 
            layers: this.spkreceiver.layers,
            client: this.mySpkReceiver, 
            senderId: this.responses[0].senderId
          }
          this.sendComputeRequest( args )
          bus.$emit('renderer-add-blur')
        }
        this.debounceCount++
      },
      deep: true
    },
    'layers': {
      handler( values ) {
        let args = {
          controllers: this.controllers, 
          layers: this.spkreceiver.layers,
          client: this.mySpkReceiver, 
          senderId: this.responses[0].senderId
        }
        this.sendComputeRequest( args )
      },
      deep: true
    }
  },
  methods: {
    sendComputeRequest: _.debounce( args => {
      console.log( args )
      let requestParams = args.controllers.map( controller => { 
        return {
          guid: controller.Guid,
          value: controller.Type != 'Point' ? controller.Value : { X: controller.X, Y: controller.Y, Z: controller.Z },
          type: controller.Type
        }
      })
      if( args.layers )
        requestParams.push( {
          type: 'MaterialTable',
          layers: args.layers.map( l => {
          return {
            name: l.name,
            // material: 'PORK BELLY SANDWICH',
            material: l.properties.selectedMaterial.type,
            price: l.properties.selectedMaterial.price,
          }
        } ) } )
      
      let message = { eventType: 'compute-request', requestParameters: requestParams }
      
      console.log( 'Sending computation request.' )
      
      args.client.sendMessage( message,  args.senderId ) 
    }, 500 ),

    receiverError( err ) {
      this.errror = err
    },

    getControllers() {
      bus.$emit( 'renderer-add-blur' )
      this.responses = []
      this.controllers = []
      this.outs = []
      this.showProgressBar = true
      this.mySpkReceiver.broadcast( { eventType: 'get-defintion-io' } )
      setTimeout( this.finaliseIo, 1000 )
    },

    collateResponses( wsMessage ) {
      this.responses.push( wsMessage )
    },

    finaliseIo() {
      this.showControllers = true
      this.showProgressBar = false
      let controllerList = this.responses[0].args.controllers
      
      controllerList.forEach( c => { 
        c.pieceWise = Math.abs(c.Max - c.Min) * c.Step < 20 ? true : false
        this.controllers.push( c ) 

        if( c.Type === 'Point' ) {
          bus.$emit( 'renderer-add-pointcontroller', c )
        }

      })

      let hasMaterialSheet = false
      this.responses[0].args.outputs.forEach( o => {
        if( o.Type != 'MaterialSheet' )
          this.outs.push( o )
        if( o.Type === 'MaterialSheet' ) {
          hasMaterialSheet = true
          let payload = { data: o.Value, streamId: this.spkreceiver.streamId }
          this.$store.commit( 'SET_LAYER_MATS', { payload } )
        }
      })
      if( hasMaterialSheet ) {
        this.showLayers = true
        this.showColorPickerLayers = false
        }
      else {
        this.showColorPickerLayers = true
        this.showLayers = false
      }

      this.sendComputeRequest( { controllers: this.controllers, layers: this.spkreceiver.layers,  client: this.mySpkReceiver, senderId: this.responses[0].senderId } )
    },

    receiverReady( name, layers, objects, history, layerMaterials ) {
      this.showProgressBar = false
      this.objLoadProgress = 0
      let payload = { streamId: this.spkreceiver.streamId, name: name, layers: layers, objects: objects, layerMaterials: layerMaterials }
      this.$store.commit( 'INIT_RECEIVER_DATA',  { payload } )
      this.getControllers()
    },

    computationResult( message ) {     
      bus.$emit('renderer-remove-blur')

      this.mySpkReceiver.getSpecificStream( message.args.streamId, stream => {
        let payload = { streamId: this.spkreceiver.streamId, name: stream.name, layers: stream.layers, objects: stream.objects }
        this.$store.commit( 'SET_RECEIVER_DATA',  { payload } )
        bus.$emit('renderer-update')
      })

      let outRefs = message.args.outputRef
      outRefs.forEach( outRef => {
        let match = this.outs.find( obj => obj.Name == outRef.Name )
        if( match )
          match.Value = outRef.Value
      })

    },

    getAndSetStream( ) {
      this.showProgressBar = true
      this.expired = false
      this.mySpkReceiver.getStream( stream => {
        let payload = { streamId: this.spkreceiver.streamId, name: stream.name, layers: stream.layers, objects: stream.objects }
        this.$store.commit( 'SET_RECEIVER_DATA',  { payload } )
        this.showProgressBar = false
        bus.$emit('renderer-update')
      } )
    },

    updateMeta( ) {
      this.mySpkReceiver.getStreamNameAndLayers( ( name, layers ) => {
        let payload = { streamId: this.spkreceiver.streamId, name: name, layers: layers }
        this.$store.commit( 'SET_RECEIVER_METADATA',  { payload } )  
      })      
    },

    objLoadProgressEv( loaded ) {
      this.objLoadProgress = ( loaded + 1 ) / this.objects.length * 100
    },
    
    broadcastReceived( message ) {
      let parsedMessage = JSON.parse( message.args )
      if( parsedMessage.event != 'comment-added' ) return
      let payload = parsedMessage.comment
      this.$store.commit( 'ADD_COMMENT', { payload } )
    }
  },
  mounted() {
    console.log( 'Stream receiver mounted for streamid: ' + this.spkreceiver.streamId )
    this.name = 'loading ' + this.spkreceiver.streamId
    
    this.showLayers = window.SpkAppConfig.showMaterialLayers

    this.mySpkReceiver = new ReceiverClient({
      baseUrl: this.spkreceiver.serverUrl ,
      streamId: this.spkreceiver.streamId,
      token: this.spkreceiver.token
    })

    this.mySpkReceiver.on( 'error', this.receiverError )
    this.mySpkReceiver.on( 'ready', this.receiverReady )
    this.mySpkReceiver.on( 'get-def-io-response', this.collateResponses )
    this.mySpkReceiver.on( 'computation-result', this.computationResult )

    bus.$on( 'pointcontroller-changed', args => {
      let myc = this.controllers.find( c => c.Guid == args.Guid )
      myc.X = args.position.X
      myc.Y = args.position.Y
      myc.Z = args.position.Z
    })
  }
}
</script>

<style>
  .controller {
    margin-bottom: 40px;
  }

  .controller:last-of-type{
    margin-bottom: 10px
  }

  .text-controller{
    margin-top: -30px;
    margin-bottom: 10px;
    text-align: center !important;
  }

  #refresh-button {
    position: absolute;
    right: 16px;
    top: 24px;
  }
  .line-height-adjustment{
    line-height: 30px;
  }
  .receiver {
    background-color: #484848 !important;
    color: white !important;
  }
  .receiver .md-caption {
      color: white !important;
  }
</style>