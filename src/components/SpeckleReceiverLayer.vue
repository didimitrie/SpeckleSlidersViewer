<template>
  <div class='spk-layer'>
    <div class='layer-details'>
    <span class="layer-name">
      {{ spklayer.name }} ({{spklayer.objectCount}} objs)
    </span>
    <span class="layer-buttons"> 
      <md-icon xxxv-show='showPicker' @click.native='showColorPicker' :style='colorStyle'>color_lens</md-icon>
      <!-- <md-icon>all_out</md-icon> -->
      <md-icon @click.native='toggleLayer'>{{ visible ? "visibility" : "visibility_off" }}</md-icon>
    </span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SpkReceiverLayer',
  // props: {[ 'spklayer', 'streamid' ]},
  props: { 
    spklayer: { type: Object },
    streamid: { type: String },
    // showColorPicker: { type: Boolean, default: true }
  },
  components: {
  },
  computed: {
    layerMaterial() {
      return this.spklayer.properties
    },
    colorStyle() {
      if( this.layerMaterial )
        return 'color:' + this.spklayer.properties.color.hex
      return 'color:gray'
    },
    showPicker() {
      return this.showColorPicker
    }
  },
  data() {
    return {
      visible: true
    }
  },
  methods: {
    showColorPicker() {
      bus.$emit( 'show-color-picker', { layerGuid: this.spklayer.guid, streamId: this.streamid } )
    },
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
  }
}
</script>

<style scoped>

.spk-layer{
  border-bottom: 1px solid #E6E6E6;
  position: relative;
  user-select: none;
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