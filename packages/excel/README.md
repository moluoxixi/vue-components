# @moluoxixi/excel

无 UI 依赖的 Excel/CSV 导入导出工具包。它只处理数据、列契约和工作簿生成，不内置按钮、文件选择器、下载器、弹窗或 Vue/Element Plus 依赖。

## 导入 Excel

```ts
import { parseExcelBlob } from '@moluoxixi/excel'

const rows = await parseExcelBlob(file, {
  columns: [
    { label: '姓名', prop: 'name' },
    { label: '年龄', prop: 'profile.age' },
  ],
})
```

`columns` 默认兼容原组件的 `title/label` 和 `field/prop` 约定。导入时会按表头匹配字段，只返回已配置列。

## 导出 Excel

```ts
import { createExcelBlob } from '@moluoxixi/excel'

const blob = createExcelBlob({
  columns: [
    { label: '姓名', prop: 'name' },
    { label: '年龄', prop: 'profile.age' },
    {
      label: '序号',
      prop: 'index',
      formatter: (_row, _column, rowIndex) => rowIndex + 1,
    },
  ],
  tableData: [
    { name: '张三', profile: { age: 18 } },
  ],
})
```

调用方负责下载或上传：

```ts
const url = URL.createObjectURL(blob)
const link = document.createElement('a')
link.href = url
link.download = '用户数据.xlsx'
link.click()
URL.revokeObjectURL(url)
```

## API 边界

- `parseExcelRows()`：从 `ArrayBuffer` 解析对象数组。
- `parseExcelBlob()`：从 `Blob/File` 解析对象数组。
- `mapExcelMatrixToRows<Row>()`：把二维数组按表头映射为对象数组；`Row` 泛型只表达调用方已知的静态返回形状，不会校验必填字段是否真实存在。
- `createExcelWorkbook()`：生成 `xlsx` 工作簿和工作表，适合二次加工。
- `createExcelWorksheet()`：生成单个工作表。
- `writeExcelBuffer()`：输出 `xlsx/csv` 二进制内容。
- `createExcelBlob()`：输出浏览器可下载的 `Blob`。

## 迁移说明

原 `ImportExcel` / `ExportExcel` 组件中的 Vue、Element Plus、按钮状态、事件提示和文件下载逻辑不在本包内。UI 组件可以只负责采集 `File`、调用本包、再把结果交给业务层。
