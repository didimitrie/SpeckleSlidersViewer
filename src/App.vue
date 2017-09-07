<template>
  <div id="app">
    <speckle-viewer></speckle-viewer>
  </div>
</template>

<script>
import SpeckleViewer    from './components/SpeckleViewer.vue'

export default {
  name: 'app',
  components: {
    SpeckleViewer
  },
  data () {
    return {
      showLogin: true,
      receiversCreated: false,
    }
  },
  methods: {
    loggedIn( args ) {
      console.log( args )
      if( args.guest === false ) {
        this.showLogin = false
        var account = args.account
        account.guest = false
        var jwtToken = JSON.parse( localStorage.getItem( 'userJwtToken' ) )
        this.$store.commit( 'SET_JWT', { jwtToken } )
        this.$store.commit( 'SET_USER', { account } )
        this.$http.defaults.headers.common['Autorization'] = jwtToken
      } else if( args.guest === true ) {
        let account = { apitoken: '', name: 'Anonymous', guest: true }
        this.$store.commit( 'SET_USER', { account } )
        this.showLogin = false
      }
      this.createReceivers( ) 
    },
    createReceivers() {
      if( this.receiversCreated ) return
      let streamIds = window.location.href.split('/')[ window.location.href.split('/').length - 1 ].split(',')
      streamIds[ 0 ] = streamIds[ 0 ].substr( 1 )
      console.log( 'streamIds:', streamIds)
      
      streamIds = streamIds.filter( ( obj, index, self ) => { return self.indexOf( obj ) === index } )
      
      if( streamIds.length == 0 || streamIds[0] === '' )
        return console.warn('no streams provided in url.')
      
      let receivers = streamIds.map( id => {
        return {
          serverUrl: window.SpkAppConfig.serverUrl,
          streamId: id,
          token: this.$store.getters.user.apitoken,
          objects: [],
          layers: [],
          history: [],
          name: 'Loading ' + id + '...',
          layerMaterials: []
        }
      })

      this.$store.commit( 'ADD_RECEIVERS', { receivers } )
      this.receiversCreated = true
    }
  },
  created() {
    this.createReceivers( )
    this.$http.get( window.SpkAppConfig.serverUrl )
    .then( response => {
      window.SpkAppConfig.serverDetails = response.data
    })
    .catch( err => {
      console.log( err )
    })
    bus.$on('app-show-login', () => {
      this.showLogin = true
    })
  }
}
</script>

<style>
body {
  background-color: #3A3A3A;
}
#app {
  position: relative;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #333333;
  /*background: -webkit-linear-gradient(to top, #666666, #808080);
  background: linear-gradient(to top, #666666, #808080);*/
}
.text-center{
  text-align: center;
}
</style>
