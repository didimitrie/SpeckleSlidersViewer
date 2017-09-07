<template>
<div id="stream-list-cover">
  <div id='stream-list' class='' ref='thestreamlist'>
    <stream-controller v-for='receiver in receivers' :key='receiver.streamId' :spkreceiver='receiver'></stream-controller>
    <div class='paddedcard' style='position:relative;' v-show='receivers.length === 0'>
      <div class="md-title">There are no clients to show.</div>
      <p>You can add a new client by click on the add button above.</p>
    </div>
  </div>
</div>
</template>

<script>
import StreamController            from './SpeckleStreamController.vue'

export default {
  name: 'SpeckleStreamList',
  components: {
    StreamController
  },
  computed: {
    receivers() {
      return this.$store.getters.allReceivers
    }
  },
  data() {
    return {
      showStreamList: true,
      showNewStreamDialgue: false
    }
  },
  methods: {
    dialogClosed() {

    },
    toggleStreamList() {
      this.showStreamList = ! this.showStreamList
      this.$refs.thestreamlist.classList.toggle('hidden')
    }
  },
  created() {
    bus.$on('showstreamadd', () => {
      this.showNewStreamDialgue = true
    })
  }
}
</script>

<style scoped>
#stream-list-cover{
  position: relative;
  padding-top: 10px;
  padding-bottom: 10px;
  top:0px;
  height: 100%;
  left: 10px;
  width: 370px;
  overflow: hidden;
  z-index: 99;
  pointer-events: none;
  box-sizing: border-box;
  z-index: 120;
}
.list-menu {
  pointer-events: auto;
  position: relative;
  left: 10px;
  margin-bottom: 10px;
  height: 5%;
}
#stream-list {
  position: relative;
  padding-right: 15px;
  /*left: 10px;*/
  top: 0;
  max-height:95%;
  width: 350px;
  box-sizing: border-box;
  /*overflow-y: scroll;*/
  z-index: 100;
  pointer-events: auto;
  transition: all .2s ease;
  opacity: 1;
}
#stream-list.hidden{
  left: -500px;
  opacity: 0;
}

#stream-list div {
}
</style>