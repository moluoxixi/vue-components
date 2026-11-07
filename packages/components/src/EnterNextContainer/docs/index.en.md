# EnterNextContainer

A keyboard navigation container that moves focus to the next input when Enter or an arrow key is pressed. It is useful for fast data-entry workflows.

## Basic Usage

:::demo Place input controls inside the container and press Enter to move to the next control.

```vue
<script setup lang="ts">
import { EnterNextContainer } from '@moluoxixi/components'
import { ElInput } from 'element-plus'
</script>

<template>
  <EnterNextContainer>
    <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;">
      <ElInput placeholder="Name (press Enter for the next field)" />
      <ElInput placeholder="Phone" />
      <ElInput placeholder="Email" />
      <ElInput placeholder="Notes" type="textarea" :rows="2" />
    </div>
  </EnterNextContainer>
</template>
```

:::

## Initial Focus

:::demo Use `focusNum` to select the control that receives focus after mounting. The index starts at 1.

```vue
<script setup lang="ts">
import { EnterNextContainer } from '@moluoxixi/components'
import { ElInput } from 'element-plus'
</script>

<template>
  <EnterNextContainer :focus-num="2">
    <div style="display:flex;flex-direction:column;gap:12px;max-width:320px;">
      <ElInput placeholder="First field" />
      <ElInput placeholder="Second field (focused by default)" />
      <ElInput placeholder="Third field" />
    </div>
  </EnterNextContainer>
</template>
```

:::

## Focus and event contract

| Interface                | Description                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Default slot             | The input region to observe.                                                                                 |
| `virtualRef`             | Optional external DOM/Vue component reference; replaces the slot container as the observed region.           |
| `focusNum`               | Initial one-based focus position. Omit it to avoid taking focus on mount.                                    |
| `autoNext`               | Defaults to true; initial focus counts enabled controls only. False counts all candidates for initial focus. |
| `allowSelectNextInEmpty` | Defaults to false; an expanded select without an active option pauses navigation.                            |
| `noNextInput(element)`   | The last enabled input; the application may submit, notify or append a row.                                  |
| `noSelectValue(element)` | An expanded dropdown needs a selection first.                                                                |

The component observes input/select/textarea elements and moves focus in DOM order on Enter keyup. MutationObserver refreshes dynamic controls; switching virtualRef or unmounting cleans up listeners. It does not submit or validate forms.

## Integration boundaries

Wrap a focused entry region instead of an entire page. Disabled controls are skipped during navigation; verify hidden/read-only control ordering in the application. Textareas are candidates too, so exclude regions where Enter must insert a newline. Dropdown behavior relies on aria-expanded / aria-activedescendant and needs verification when adapting another UI library.
