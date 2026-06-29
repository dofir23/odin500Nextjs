import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

let registered = false;

/** Register Chart.js modules once (comparison bar/line charts). */
export function registerChartJs() {
  if (registered) return;
  Chart.register(
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    ArcElement,
    DoughnutController,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
    Filler,
    ChartDataLabels
  );
  registered = true;
}

registerChartJs();
