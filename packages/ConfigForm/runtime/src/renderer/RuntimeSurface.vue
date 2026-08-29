<!--
  RuntimeSurface is the shared rendering entry used by Design Canvas and
  Preview. ConfigFormRenderer owns the headless form controller and delegates
  its recursive tree through the same implementation; this alias keeps the
  public renderer API backwards compatible while exposing an explicit surface
  name for new integrations.
-->
<script lang="ts">
import ConfigFormRenderer from './ConfigFormRenderer.vue'

export default ConfigFormRenderer
</script>

