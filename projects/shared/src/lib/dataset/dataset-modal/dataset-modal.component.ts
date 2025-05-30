import { Component, OnInit, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AnnotationsOptions } from 'highcharts';

import * as Highcharts from 'highcharts';
import annotations from 'highcharts/modules/annotations';

import { CircleProgressOptions } from 'ng-circle-progress/lib/ng-circle-progress.component';
import { DataSetEntry, StreakStack, Month } from 'projects/shared/src/lib/app/model';
import { StatsBuilderService } from 'projects/shared/src/lib/service/stats-builder.service';
import { TranslatePipe } from 'projects/shared/src/lib/service/translate.pipe';

import { UsernameService } from 'projects/shared/src/lib/service/username.service';
import { distinctUntilChanged } from 'rxjs';
import { MapperService } from '../../service/mapper.service';

annotations(Highcharts);

@UntilDestroy()
@Component({
  selector: 'app-dataset-modal',
  templateUrl: './dataset-modal.component.html',
  styleUrls: ['./dataset-modal.component.scss'],
  providers: [TranslatePipe]
})
export class DatasetModalComponent implements OnInit {
  Highcharts: typeof Highcharts = Highcharts;
  options: (Partial<CircleProgressOptions> | undefined)[] = [];
  chartOptions: Highcharts.Options = {};
  url?: string;
  chart?: Highcharts.Chart;

  constructor(@Inject(MAT_DIALOG_DATA) public data: DataSetEntry,
              private stats: StatsBuilderService,
              private username: UsernameService,
              private translate: TranslatePipe,
              private mapper: MapperService) { }

  ngOnInit(): void {
    const scrobblesTitle = this.translate.capFirst('translate.scrobbles');
    this.options = [
      this.circleOption(scrobblesTitle, this.data.scrobbles),
      this.data.tracks ? this.circleOption('Tracks', this.data.tracks) : undefined,
      this.circleOption('Weeks', this.data.item.weeks.length),
    ];

    this.url = this.mapper.url(this.data.type, this.data.item);

    const ranks: (number | null)[] = [];
    for (let i = 0; i < this.data.item.ranks.length; i++) {
      ranks[i] = this.data.item.ranks[i] || null;
    }

    this.chartOptions = {
      title: {
        text: ''
      },
      xAxis: {
        type: 'category',
        allowDecimals: false,
        categories: []//Object.values(months).map(m => m.alias)
      },
      yAxis: [{
        min: 1,
        reversed: true,
        startOnTick: true,
        allowDecimals: false,
        gridLineWidth: 0,
        title: { text: 'Rank' }
      }, {
        opposite: true,
        title: { text: scrobblesTitle }
      }],
      legend: { enabled: false },
      series: [{
        name: 'Rank',
        type: 'line',
        color: 'var(--primaryColor)',
        data: ranks
      }, {
        name: scrobblesTitle,
        type: 'line',
        yAxis: 1,
        color: 'var(--primaryColorContrast)',
        data: []
      }],
      responsive: {
        rules: [{
          condition: { minWidth: 769 },
          chartOptions: {
            annotations: [
              // this.annotationOptions(first, scrobbles[first]!, `First ${this.translate.transform('translate.scrobble')}: ${this.first.toLocaleString()}`, 'right'),
              // this.annotationOptions(last, scrobbles[last]!, `Last ${this.translate.transform('translate.scrobble')}: ${this.last.toLocaleString()}`, 'left'),
              // this.mostScrobbledDayAnnotation(scrobbles),
            ]
          }
        }]
      }
    };

    this.stats.tempStats.pipe(untilDestroyed(this), distinctUntilChanged()).subscribe(stats => {
      const months = stats.monthList;
      const scrobbles = this.mapper.cumulativeMonths(this.data.type, Object.values(months), this.data.item);
      const first = ranks.findIndex(p => p !== null);
      const last = Object.keys(months).indexOf(this.mapper.getMonthYear(this.last));

      this.chart?.update({
        xAxis: {categories: Object.values(months).map(m => m.alias)},
        responsive: {
          rules: [{
            condition: {minWidth: 769},
            chartOptions: {
              annotations: [
                this.annotationOptions(first, scrobbles[first]!, `First ${this.translate.transform('translate.scrobble')}: ${this.first.toLocaleString()}`, 'right'),
                this.annotationOptions(last, scrobbles[last]!, `Last ${this.translate.transform('translate.scrobble')}: ${this.last.toLocaleString()}`, 'left'),
                this.mostScrobbledDayAnnotation(scrobbles, months),
              ]
            }
          }]
        }
      });
    });
  }

  private circleOption(title: string, value: number): Partial<CircleProgressOptions> {
    return {
      subtitle: title,
      titleFormat: (p: number) => Math.round((value / 100) * p)
    };
  }

  private mostScrobbledDayAnnotation(scrobbles: number[], months: { [p: string]: Month }): AnnotationsOptions {
    const days = this.data.item.scrobbles.reduce(function (rv, x) {
      const key = String(StreakStack.startOfDay(new Date(x)).getTime());
      rv[key] = (rv[key] || 0) + 1;
      return rv;
    }, {} as { [key: string]: number })
    const max = Object.keys(days).reduce((a, b) => days[parseInt(a)] > days[parseInt(b)] ? a : b);
    const day = new Date(parseInt(max));
    const most = Object.keys(months).indexOf(this.mapper.getMonthYear(day));
    return this.annotationOptions(most, scrobbles[most], `Most ${this.translate.transform('translate.scrobbled')} day: ${day.toLocaleDateString()} (${days[max]} ${this.translate.transform('translate.scrobbles')})`, 'left');
  }

  private annotationOptions(x: number, y: number, text: string, align: Highcharts.AlignValue): Highcharts.AnnotationsOptions {
    return {
      draggable: '',
      labels: [{
        allowOverlap: true,
        align,
        verticalAlign: align === 'left' ? 'bottom' : 'top',
        style: { pointerEvents: 'none' },
        point: {
          x, y,
          xAxis: 0,
          yAxis: 1
        },
        text,
      }]
    }
  }

  private get first(): Date {
    return new Date(this.data.item.scrobbles[0]);
  }

  private get last(): Date {
    return new Date(this.data.item.scrobbles[this.data.item.scrobbles.length - 1]);
  }

  showLabels(checked: boolean): void {
    this.chartOptions.responsive?.rules![0].chartOptions!.annotations!.forEach(a => a.visible = checked)
    this.chart?.update(this.chartOptions);
  }
}
