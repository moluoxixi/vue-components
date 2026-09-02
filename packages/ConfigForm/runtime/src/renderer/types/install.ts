import type { Component, Plugin } from 'vue'

export type InstallableConfigFormComponent<T extends Component> = T & Plugin
