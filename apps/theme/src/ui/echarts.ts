import { use, init } from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  BrushComponent,
  DataZoomComponent,
  ToolboxComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  BrushComponent,
  DataZoomComponent,
  ToolboxComponent,
  SVGRenderer,
]);
export { init };
