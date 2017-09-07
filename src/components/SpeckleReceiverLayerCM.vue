<template>
  <div class='spk-layer'>
    <div class='layer-details'>
     <md-input-container>
        <label for="material">Material for {{spklayer.name}}</label>
        <md-select name="material" id="material" v-model="material">
          <md-option v-for='mat in selectMaterials' :value='mat.type'>{{mat.type}} <!-- <small>({{mat.price + mat.unitForPrice }})</small> --></md-option>
        </md-select>
      </md-input-container>
    </div>
  </div>
</template>

<script>
import * as THREE         from 'three'
let tloader = new THREE.TextureLoader()

export default {
  name: 'SpkReceiverLayer',
  props: { 
    spklayer: { type: Object },
    streamid: { type: String },
  },
  components: {
  },
  watch: {
    material: {
      handler( newValue ) {
        let material = this.spklayer.properties.availableMaterials.find( mat => mat.type === newValue )
        this.spklayer.properties.selectedMaterial = material

        this.layerMaterial.threeMeshMaterial.color = new THREE.Color( 'rgb(' + material.rgb + ')' )
        this.layerMaterial.threeLineMaterial.color = new THREE.Color( 'rgb(' + material.edgeRgb + ')' )
        this.layerMaterial.threePointMaterial.color = new THREE.Color( 'rgb(' + material.rgb + ')' )
        this.layerMaterial.threeMeshMaterial.opacity = material.alpha
        this.layerMaterial.threeLineMaterial.opacity = material.alpha
        this.layerMaterial.threePointMaterial.opacity = material.alpha
        this.layerMaterial.threeMeshMaterial.shininess = material.shiny
        this.layerMaterial.threeMeshVertexColorsMaterial.shininess = material.shiny

        this.layerMaterial.threeEdgesMaterial.visible = material.displayEdges

        // bus.$emit( 'material-changed' )
      }
    }
  },
  computed: {
    selectMaterials () {
      return this.spklayer.properties.availableMaterials.filter( m => m.available )
    },
    layerMaterial() {
      return this.spklayer.properties
    }
  },
  methods: {
  },
  data() {
    return {
      visible: true,
      material: ''
    }
  },
  methods: {
    toggleLayer() {
      this.visible = ! this.visible
      this.layerMaterial.threeMeshMaterial.visible = this.visible
      this.layerMaterial.threeMeshVertexColorsMaterial.visible = this.visible
      this.layerMaterial.threeLineMaterial.visible = this.visible
      this.layerMaterial.threeEdgesMaterial.visible = this.layerMaterial.showEdges ? this.visible : this.layerMaterial.threeEdgesMaterial.visible
      this.layerMaterial.threePointMaterial.visible = this.visible
    }
  }, 
  mounted() {
    // super shitty hack
    setTimeout( () => {
      this.material = this.selectMaterials[0].type
    }, 1000 )
  }
}
</script>

<style scoped>

.spk-layer{
  /*border-bottom: 1px solid #E6E6E6;*/
  position: relative;
  user-select: none;
  /*height: 120px;*/
  box-sizing: border-box;
  padding: 4px;
}
.md-has-select label{
  color: #BFBFBF !important;
}

.spk-layer:last-of-type{
  border-bottom: 0;
}
.layer-details {
  line-height: 50px;
  font-size: 12px;
  height: 50px;
}
.layer-name {
  float: left;
  display: inline-block;
  width: 50%;
  overflow: hidden;
}
.layer-buttons {
  /*padding-top: 5px;*/
  text-align: right;
  float: left;
  display: inline-block;
  width: 50%;
  box-sizing: border-box;
  color: #666666;
  /*cursor: pointer;*/
}

.layer-buttons .md-icon {
  cursor: pointer;
}

</style>