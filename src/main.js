import { createApp } from 'vue'
import naive from 'naive-ui'
import App from './App.vue'
import { appTitle } from './settings'
import { applyThemeCssVars } from '@/theme'
import './styles/index.css'

applyThemeCssVars()
document.title = appTitle

createApp(App).use(naive).mount('#app')
