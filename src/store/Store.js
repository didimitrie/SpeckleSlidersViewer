import Vue from 'vue'
import Vuex from 'vuex'
import LMat from './LayerMaterial'
import Materials from './Materials'

import * as THREE from 'three'

Vue.use( Vuex )

export default new Vuex.Store( {
  state: {
    mobile: false,
    receivers: [ ],
    comments: [ ],
    user: {},
    jwtToken: '',
    Materials: Materials
  },
  getters: {
    isMobile: state => state.mobile,
    user: state => state.user,
    authToken: state => state.jwtToken,
    allReceivers: state => state.receivers,
    receiverById: state => ( streamId ) => {
      return state.receivers.find( rec => rec.streamId === streamId )
    },
    allComments: state => state.comments,
    receiverComments: state => ( streamId ) => {
      return state.comments.filter( comment => comment.streamId === streamId ).reverse( )
    },
    receiverLayers: state => ( streamId ) => {
      return state.receivers.find( rec => rec.streamId === streamId ).layers
    },
    layerMaterial: ( state, getters ) => ( streamId, layerGuid ) => {
      return getters.receiverById( streamId ).layers.find( item => item.guid === layerGuid ).properties
    },
    allObjects: state => {
      return state.receivers.reduce( ( p, c ) => { return [ ...p, ...c.objects ] }, [ ] )
    },
    allLayerMaterials: ( state ) => {
      let arr = [ ]
      state.receivers.forEach( rec => {
        rec.layers.forEach( layer => {
          arr.push( layer.properties )
        })
      } )
      // console.log( arr )
      return arr
      // return arr.concat.apply( [ ], arr )
    },
    allMaterials: (state) => {
      return state.Materials
    },
    materialsForLayer: ( state ) => ( layerGuid ) => {
      return state.Materials
    }
  },
  actions: {},
  mutations: {
    MOBILE_VIEW( state ) {
      state.mobile = true
    },
    SET_JWT( state, { jwtToken } ) {
      state.jwtToken = jwtToken
    },
    SET_USER( state, { account } ) {
      state.user = account
    },

    ADD_RECEIVERS( state, { receivers } ) {
      state.receivers = receivers
    },
    ADD_RECEIVER( state, { receiver } ) {
      state.receivers.push( receiver )
    },

    ADD_COMMENT( state, { payload } ) {
      state.comments.push( payload )
    },

    ADD_COMMENTS( state, { payload } ) {
      state.comments.push( ...payload.comments )
    },

    UPDATE_LAYER_PROPS( state, { payload } ) {
      console.log( payload )
      let l = state.receivers.find( rec => rec.streamId === payload.streamId ).layers.find( l => l.guid == payload.guid ).properties
      console.log( l )
      l.color.hex = payload.hex
      l.threeMeshMaterial.color = new THREE.Color( payload.hex )
      l.threeLineMaterial.color = new THREE.Color( payload.hex )
      l.threePointMaterial.color = new THREE.Color( payload.hex )
      l.threeMeshMaterial.opacity = payload.a
      l.threeLineMaterial.opacity = payload.a
      l.threePointMaterial.opacity = payload.a

    },

    SET_LAYER_MATS( state, { payload } ) {
      let lines = payload.data.split('\n')
      
      lines.forEach( line => {
        let layerName = line.split(':')[0]
        let targetLayer = state.receivers.find( rec => rec.streamId === payload.streamId ).layers.find( la => la.name === layerName )
        
        if( !targetLayer ) console.error('Wot, no layer with dis name', layerName )
        else {
          let layerMatNames = line.split(':')[1]
          let avmats = targetLayer.properties.availableMaterials;
          avmats.forEach( mat => {
            if( layerMatNames.indexOf( mat.type ) > -1 ) mat.available = true
            else mat.available = false
          })
        }
      })
    },

    INIT_RECEIVER_DATA( state, { payload } ) {
      let target = state.receivers.find( rec => rec.streamId === payload.streamId )
      target.name = payload.name

      // set objects
      target.objects = payload.objects.map( ( obj, index ) => {
        return {
          streamId: payload.streamId,
          layerGuid: payload.layers.find( layer => {
            return index >= layer.startIndex && index < layer.startIndex + layer.objectCount
          } ).guid,
          _id: obj
        }
      } )

      target.layers = payload.layers.map( layer => {
        if( layer.properties === undefined ) {
          layer.properties = new LMat( { guid: layer.guid, streamId: target.streamId } ) 
          return layer
        } else {
          layer.properties.availableMaterials = Materials()
          layer.properties.selectedMaterial = Materials()[0]
          layer.properties.threeMeshMaterial = new THREE.MeshPhongMaterial( { ...layer.properties.threeMeshMaterial } )
          layer.properties.threeLineMaterial = new THREE.LineBasicMaterial( { ...layer.properties.threeLineMaterial } )
          layer.properties.threeEdgesMaterial = new THREE.LineBasicMaterial( { ...layer.properties.threeEdgesMaterial } )
          layer.properties.threeEdgesMaterial.visible = layer.properties.showEdges
          layer.properties.threePointMaterial = new THREE.PointsMaterial( { ...layer.properties.threePointMaterial } )
          if ( layer.properties.threeMeshVertexColorsMaterial )
              layer.properties.threeMeshVertexColorsMaterial = new THREE.MeshPhongMaterial( { ...layer.properties.threeMeshVertexColorsMaterial } )
            else
              layer.properties.threeMeshVertexColorsMaterial = new LMat( { guid: layer.properties.guid, streamId: target.streamId } ).threeMeshVertexColorsMaterial
          return layer
        }
      })
    },

    SET_RECEIVER_METADATA( state, { payload } ) {
      let target = state.receivers.find( rec => rec.streamId === payload.streamId )
      target.name = payload.name
      target.layers.forEach( l => {
        let match = payload.layers.find( la => la.guid == l.guid )
        if( match )
        {
          l.name = match.name
        } else {
          // REMOVE LAYER
        }
      })
      // TODO: iterate through new list and add if required
    },

    SET_RECEIVER_DATA( state, { payload } ) {
      let target = state.receivers.find( rec => rec.streamId === payload.streamId )

      target.name = payload.name
      
      let layersToRemove = [], layersToAdd = []

      target.layers.forEach( l => {
        let match = payload.layers.find( la => la.guid == l.guid )
        if( match )
        {
          l.name = match.name
        } else {
          layersToRemove.push( l )
        }
      })

      payload.layers.forEach( l => {
        let match = target.layers.find( la => la.guid == l.guid )
        if( !match )
          layersToAdd.push( l )
      })
      
      // set objects
      target.objects = payload.objects.map( ( obj, index ) => {
        return {
          streamId: payload.streamId,
          layerGuid: payload.layers.find( layer => {
            return index >= layer.startIndex && index < layer.startIndex + layer.objectCount
          } ).guid,
          _id: obj
        }
      } )
    }
  }
} )