<script setup lang="ts">
import type {
  DataEntityKind,
  DataWorkspaceEmits,
  DataWorkspaceExpose,
  DataWorkspaceProps,
} from '../../types'
import { Database, Play, Plus, Save, Square, Trash2, Variable, X } from '@lucide/vue'
import { computed } from 'vue'
import { DataValueEditor } from '../DataValueEditor'
import { useDataWorkspace } from '../../composables'

const props = defineProps<DataWorkspaceProps>()
const emit = defineEmits<DataWorkspaceEmits>()

const {
  DATA_SOURCE_EDITOR_MAX_DURATION_MS,
  METHOD_OPTIONS,
  RESPONSE_TYPE_OPTIONS,
  addDataSource,
  addDependency,
  addVariable,
  cancel,
  cancelTest,
  canSave,
  canTest,
  confirmClose,
  dataSourceCatalog,
  dataSources,
  dirty,
  expandedSections,
  kindOptions,
  locale,
  mappingContextValues,
  referenceFields,
  removeDependency,
  removeSelected,
  save,
  saving,
  selectEntity,
  selectKind,
  selectedDataSource,
  selectedKind,
  selectedNameInvalid,
  selectedUrlInvalid,
  selectedVariable,
  selectedVariableCatalog,
  setAuto,
  setDependency,
  setDuration,
  setMapping,
  setMappingEnabled,
  setOptionalRequestEnabled,
  setOptionalRequestValue,
  setRequestValue,
  setSelectedName,
  setVariableInitialValue,
  testDataSource,
  testPreview,
  testState,
  variableCatalog,
  variables,
  visibleDiagnostics,
} = useDataWorkspace(props, () => emit('close'))

const selectedEntries = computed(() => selectedKind.value === 'variables' ? variables.value : dataSources.value)
const selectedEntityTitle = computed(() => selectedKind.value === 'variables'
  ? locale.value.t('data.variable', 'Variable')
  : locale.value.t('data.source', 'Data source'))
const addLabel = computed(() => selectedKind.value === 'variables'
  ? locale.value.t('data.addVariable', 'Add variable')
  : locale.value.t('data.addSource', 'Add data source'))
const removeLabel = computed(() => locale.value.t(
  selectedKind.value === 'variables' ? 'data.removeVariable' : 'data.removeSource',
  selectedKind.value === 'variables' ? 'Remove variable' : 'Remove data source',
))

function changeKind(value: string | number): void {
  selectKind(String(value) as DataEntityKind)
}

function addSelectedKind(): void {
  if (selectedKind.value === 'variables')
    addVariable()
  else
    addDataSource()
}

defineExpose<DataWorkspaceExpose>({ cancel, confirmClose, save, testDataSource })
</script>

<template>
  <section class="data-workspace" :aria-label="locale.t('data.workspace', 'Page data workspace')">
    <div class="data-workspace__main">
      <aside class="data-catalog">
        <ElSegmented
          class="data-kind-switch"
          block
          :model-value="selectedKind"
          :options="kindOptions"
          :aria-label="locale.t('data.kind', 'Data kind')"
          @change="changeKind"
        />

        <div class="data-catalog__toolbar">
          <strong>{{ selectedKind === 'variables' ? locale.t('data.variables', 'Variables') : locale.t('data.sources', 'Data sources') }}</strong>
          <span>{{ selectedEntries.length }}</span>
          <ElButton
            native-type="button"
            text
            :disabled="readonly"
            :title="addLabel"
            :aria-label="addLabel"
            data-testid="add-data-entry"
            @click="addSelectedKind"
          >
            <Plus :size="15" aria-hidden="true" />
          </ElButton>
        </div>

        <ElScrollbar class="data-catalog__scrollbar">
          <div v-if="selectedEntries.length > 0" class="data-catalog__list" role="listbox" :aria-label="selectedEntityTitle">
            <ElButton
              v-for="entry in selectedEntries"
              :key="entry.id"
              native-type="button"
              text
              role="option"
              class="data-catalog__entry"
              :class="{ 'is-active': entry.id === (selectedVariable?.id ?? selectedDataSource?.id) }"
              :aria-selected="entry.id === (selectedVariable?.id ?? selectedDataSource?.id)"
              :data-data-entry-id="entry.id"
              @click="selectEntity(selectedKind, entry.id)"
            >
              <Variable v-if="selectedKind === 'variables'" :size="14" aria-hidden="true" />
              <Database v-else :size="14" aria-hidden="true" />
              <span>{{ entry.name }}</span>
            </ElButton>
          </div>
          <ElEmpty
            v-else
            class="data-catalog__empty"
            :description="selectedKind === 'variables' ? locale.t('data.emptyVariables', 'No variables') : locale.t('data.emptySources', 'No data sources')"
            :image-size="42"
          />
        </ElScrollbar>
      </aside>

      <ElScrollbar class="data-editor-scrollbar">
        <div v-if="selectedVariable || selectedDataSource" class="data-editor">
          <header class="data-editor__header">
            <div>
              <span>{{ selectedEntityTitle }}</span>
              <strong>{{ selectedVariable?.name ?? selectedDataSource?.name }}</strong>
            </div>
            <ElButton
              native-type="button"
              text
              type="danger"
              :disabled="readonly"
              :title="removeLabel"
              :aria-label="removeLabel"
              data-testid="remove-data-entry"
              @click="removeSelected"
            >
              <Trash2 :size="16" aria-hidden="true" />
            </ElButton>
          </header>

          <div class="data-editor__identity">
            <label class="data-field">
              <span>{{ locale.t('data.name', 'Name') }}</span>
              <ElInput
                :model-value="selectedVariable?.name ?? selectedDataSource?.name"
                :disabled="readonly"
                :maxlength="160"
                :aria-label="locale.t('data.name', 'Name')"
                :aria-invalid="selectedNameInvalid || undefined"
                data-data-control="name"
                @update:model-value="setSelectedName"
              />
              <small v-if="selectedNameInvalid" class="data-field__error" role="alert">{{ locale.t('data.nameRequired', 'Enter a name.') }}</small>
            </label>
          </div>

          <section v-if="selectedVariable" class="data-editor__section">
            <div class="data-section-heading">
              <h3>{{ locale.t('data.initialValue', 'Initial value') }}</h3>
            </div>
            <DataValueEditor
              :model-value="selectedVariable.initialValue"
              :disabled="readonly"
              :fields="referenceFields"
              :variables="selectedVariableCatalog"
              :data-sources="dataSourceCatalog"
              :locale="locale"
              @update:model-value="setVariableInitialValue"
            />
          </section>

          <ElCollapse v-else-if="selectedDataSource" v-model="expandedSections" class="data-source-sections">
            <ElCollapseItem name="request">
              <template #title>
                <span class="data-collapse-title">{{ locale.t('data.request', 'Request') }}</span>
              </template>
              <div class="data-request-grid">
                <div class="data-field">
                  <span>{{ locale.t('data.method', 'Method') }}</span>
                  <DataValueEditor
                    :model-value="selectedDataSource.request.method ?? 'GET'"
                    control="enum"
                    :options="METHOD_OPTIONS"
                    :disabled="readonly"
                    :fields="referenceFields"
                    :variables="variableCatalog"
                    :data-sources="dataSourceCatalog"
                    :locale="locale"
                    @update:model-value="setRequestValue('method', $event)"
                  />
                </div>
                <div class="data-field">
                  <span>{{ locale.t('data.responseType', 'Response type') }}</span>
                  <DataValueEditor
                    :model-value="selectedDataSource.request.responseType ?? 'json'"
                    control="enum"
                    :options="RESPONSE_TYPE_OPTIONS"
                    :disabled="readonly"
                    :fields="referenceFields"
                    :variables="variableCatalog"
                    :data-sources="dataSourceCatalog"
                    :locale="locale"
                    @update:model-value="setRequestValue('responseType', $event)"
                  />
                </div>
                <div class="data-field data-field--wide">
                  <span>{{ locale.t('data.url', 'URL') }}</span>
                  <DataValueEditor
                    :model-value="selectedDataSource.request.url"
                    control="text"
                    required
                    :invalid="selectedUrlInvalid"
                    :disabled="readonly"
                    :fields="referenceFields"
                    :variables="variableCatalog"
                    :data-sources="dataSourceCatalog"
                    :locale="locale"
                    @update:model-value="setRequestValue('url', $event)"
                  />
                  <small v-if="selectedUrlInvalid" class="data-field__error" role="alert">{{ locale.t('data.urlRequired', 'Enter a URL or choose a value source.') }}</small>
                </div>

                <div class="data-optional data-field--wide">
                  <div class="data-toggle-row">
                    <span>{{ locale.t('data.headers', 'Headers') }}</span>
                    <ElSwitch
                      :model-value="selectedDataSource.request.headers !== undefined"
                      :disabled="readonly"
                      :aria-label="locale.t('data.headersEnabled', 'Include headers')"
                      @change="setOptionalRequestEnabled('headers', Boolean($event))"
                    />
                  </div>
                  <DataValueEditor
                    v-if="selectedDataSource.request.headers !== undefined"
                    :model-value="selectedDataSource.request.headers"
                    control="object"
                    :disabled="readonly"
                    :fields="referenceFields"
                    :variables="variableCatalog"
                    :data-sources="dataSourceCatalog"
                    :locale="locale"
                    @update:model-value="setOptionalRequestValue('headers', $event)"
                  />
                </div>

                <div class="data-optional data-field--wide">
                  <div class="data-toggle-row">
                    <span>{{ locale.t('data.query', 'Query parameters') }}</span>
                    <ElSwitch
                      :model-value="selectedDataSource.request.query !== undefined"
                      :disabled="readonly"
                      :aria-label="locale.t('data.queryEnabled', 'Include query parameters')"
                      @change="setOptionalRequestEnabled('query', Boolean($event))"
                    />
                  </div>
                  <DataValueEditor
                    v-if="selectedDataSource.request.query !== undefined"
                    :model-value="selectedDataSource.request.query"
                    control="object"
                    :disabled="readonly"
                    :fields="referenceFields"
                    :variables="variableCatalog"
                    :data-sources="dataSourceCatalog"
                    :locale="locale"
                    @update:model-value="setOptionalRequestValue('query', $event)"
                  />
                </div>

                <div class="data-optional data-field--wide">
                  <div class="data-toggle-row">
                    <span>{{ locale.t('data.body', 'Body') }}</span>
                    <ElSwitch
                      :model-value="selectedDataSource.request.body !== undefined"
                      :disabled="readonly"
                      :aria-label="locale.t('data.bodyEnabled', 'Include request body')"
                      @change="setOptionalRequestEnabled('body', Boolean($event))"
                    />
                  </div>
                  <DataValueEditor
                    v-if="selectedDataSource.request.body !== undefined"
                    :model-value="selectedDataSource.request.body"
                    :disabled="readonly"
                    :fields="referenceFields"
                    :variables="variableCatalog"
                    :data-sources="dataSourceCatalog"
                    :locale="locale"
                    @update:model-value="setOptionalRequestValue('body', $event)"
                  />
                </div>
              </div>
            </ElCollapseItem>

            <ElCollapseItem name="dependencies">
              <template #title>
                <span class="data-collapse-title">{{ locale.t('data.dependencies', 'Dependencies') }}</span>
              </template>
              <div class="data-dependencies">
                <div v-for="(dependency, index) in selectedDataSource.dependencies ?? []" :key="index" class="data-dependency-row">
                  <DataValueEditor
                    :model-value="dependency"
                    :disabled="readonly"
                    :fields="referenceFields"
                    :variables="variableCatalog"
                    :data-sources="dataSourceCatalog"
                    :locale="locale"
                    @update:model-value="setDependency(index, $event)"
                  />
                  <ElButton
                    native-type="button"
                    text
                    :disabled="readonly"
                    :title="locale.t('data.removeDependency', 'Remove dependency')"
                    :aria-label="locale.t('data.removeDependency', 'Remove dependency')"
                    @click="removeDependency(index)"
                  >
                    <Trash2 :size="14" aria-hidden="true" />
                  </ElButton>
                </div>
                <ElButton native-type="button" :disabled="readonly" data-testid="add-dependency" @click="addDependency">
                  <Plus :size="14" aria-hidden="true" />
                  {{ locale.t('data.addDependency', 'Add dependency') }}
                </ElButton>
              </div>
            </ElCollapseItem>

            <ElCollapseItem name="behavior">
              <template #title>
                <span class="data-collapse-title">{{ locale.t('data.behavior', 'Loading and cache') }}</span>
              </template>
              <div class="data-behavior-grid">
                <div class="data-toggle-row data-toggle-row--control">
                  <strong>{{ locale.t('data.auto', 'Automatic loading') }}</strong>
                  <ElSwitch
                    :model-value="selectedDataSource.auto ?? false"
                    :disabled="readonly"
                    :aria-label="locale.t('data.auto', 'Automatic loading')"
                    @change="setAuto(Boolean($event))"
                  />
                </div>
                <label class="data-field">
                  <span>{{ locale.t('data.timeout', 'Timeout (ms, 0 disables)') }}</span>
                  <ElInputNumber
                    :model-value="selectedDataSource.timeoutMs ?? 10000"
                    :disabled="readonly"
                    :min="0"
                    :max="DATA_SOURCE_EDITOR_MAX_DURATION_MS"
                    :step="100"
                    controls-position="right"
                    :aria-label="locale.t('data.timeout', 'Timeout (ms, 0 disables)')"
                    @change="setDuration('timeoutMs', $event)"
                  />
                </label>
                <label class="data-field">
                  <span>{{ locale.t('data.cacheTtl', 'Cache TTL (ms, 0 disables)') }}</span>
                  <ElInputNumber
                    :model-value="selectedDataSource.cacheTtlMs ?? 0"
                    :disabled="readonly"
                    :min="0"
                    :max="DATA_SOURCE_EDITOR_MAX_DURATION_MS"
                    :step="100"
                    controls-position="right"
                    :aria-label="locale.t('data.cacheTtl', 'Cache TTL (ms, 0 disables)')"
                    @change="setDuration('cacheTtlMs', $event)"
                  />
                </label>
              </div>
            </ElCollapseItem>

            <ElCollapseItem name="mapping">
              <template #title>
                <span class="data-collapse-title">{{ locale.t('data.mapping', 'Response mapping') }}</span>
              </template>
              <div class="data-mapping">
                <div class="data-toggle-row">
                  <span>{{ locale.t('data.mappingEnabled', 'Transform response') }}</span>
                  <ElSwitch
                    :model-value="selectedDataSource.mapping !== undefined"
                    :disabled="readonly"
                    :aria-label="locale.t('data.mappingEnabled', 'Transform response')"
                    @change="setMappingEnabled(Boolean($event))"
                  />
                </div>
                <DataValueEditor
                  v-if="selectedDataSource.mapping !== undefined"
                  :model-value="selectedDataSource.mapping"
                  :disabled="readonly"
                  :fields="referenceFields"
                  :context-values="mappingContextValues"
                  :variables="variableCatalog"
                  :data-sources="dataSourceCatalog"
                  :locale="locale"
                  @update:model-value="setMapping"
                />
              </div>
            </ElCollapseItem>

            <ElCollapseItem name="test">
              <template #title>
                <span class="data-collapse-title">{{ locale.t('data.testResult', 'Test result') }}</span>
              </template>
              <div class="data-test">
                <div class="data-test__toolbar">
                  <ElButton
                    native-type="button"
                    :disabled="!canTest"
                    data-testid="test-data-source"
                    @click="testDataSource"
                  >
                    <Play :size="14" aria-hidden="true" />
                    {{ testState.status === 'loading' ? locale.t('data.testing', 'Testing') : locale.t('data.test', 'Test') }}
                  </ElButton>
                  <ElButton
                    v-if="testState.status === 'loading'"
                    native-type="button"
                    data-testid="cancel-data-test"
                    :title="locale.t('data.stopTest', 'Stop test')"
                    :aria-label="locale.t('data.stopTest', 'Stop test')"
                    @click="cancelTest()"
                  >
                    <Square :size="14" aria-hidden="true" />
                  </ElButton>
                  <small v-if="!onRequest">{{ locale.t('data.testUnavailable', 'Request capability unavailable') }}</small>
                </div>
                <div class="data-test__result" :data-status="testState.status" aria-live="polite">
                  <p v-if="testState.status === 'idle'">{{ locale.t('data.testIdle', 'No test result') }}</p>
                  <p v-else-if="testState.status === 'loading'" role="status">{{ locale.t('data.testingRequest', 'Request in progress') }}</p>
                  <ElAlert
                    v-else-if="testState.status === 'error'"
                    type="error"
                    show-icon
                    :closable="false"
                    :title="testState.error?.message ?? locale.t('data.testFailed', 'Request failed')"
                  >
                    <small v-if="testState.error?.path">{{ testState.error.path }}</small>
                  </ElAlert>
                  <ElEmpty
                    v-else-if="testState.status === 'empty'"
                    :description="locale.t('data.testEmpty', 'The request returned no data')"
                    :image-size="42"
                  />
                  <pre v-else data-testid="data-test-preview">{{ testPreview }}</pre>
                </div>
              </div>
            </ElCollapseItem>
          </ElCollapse>
        </div>

        <ElEmpty
          v-else
          class="data-editor__empty"
          :description="selectedKind === 'variables' ? locale.t('data.selectVariable', 'Add or select a variable') : locale.t('data.selectSource', 'Add or select a data source')"
          :image-size="52"
        />
      </ElScrollbar>
    </div>

    <footer class="data-workspace__footer">
      <div class="data-workspace__status">
        <span v-if="dirty">{{ locale.t('data.unsaved', 'Unsaved changes') }}</span>
        <ul v-if="visibleDiagnostics.length > 0" class="data-diagnostics" role="alert">
          <li v-for="(diagnostic, index) in visibleDiagnostics" :key="`${diagnostic.code}-${index}`">{{ diagnostic.message }}</li>
        </ul>
      </div>
      <div class="data-workspace__actions">
        <ElButton native-type="button" :disabled="saving" data-testid="cancel-data" @click="cancel">
          <X :size="14" aria-hidden="true" />
          {{ locale.t('action.cancel', 'Cancel') }}
        </ElButton>
        <ElButton native-type="button" type="primary" :loading="saving" :disabled="!canSave" data-testid="save-data" @click="save">
          <Save :size="14" aria-hidden="true" />
          {{ locale.t('action.save', 'Save') }}
        </ElButton>
      </div>
    </footer>
  </section>
</template>
