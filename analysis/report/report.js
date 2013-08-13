///////////////////////////////////////////////////////////////////////////////////
// Domain Pairs
///////////////////////////////////////////////////////////////////////////////////
(function domainPairs(){
   var values = CMData.domain_pair_histogram.values;
   var ids = CMData.domain_pair_histogram.id;
   var domain_map = CMData.domain_pair_map;

   var chart;

   var chartData = [{
                      domains: values[0],
                      value: ids[0]
                    },
                    {
                      domains: values[1],
                      value: ids[1]
                    },
                    {
                      domains: values[2],
                      value: ids[2]
                    },
                    {
                      domains: values[3],
                      value: ids[3]
                    },
                    {
                      domains: values[4],
                      value: ids[4]
                    },
                    {
                      domains: values[5],
                      value: ids[5]
                    },
                    {
                      domains: values[6],
                      value: ids[6]
                    },
                    {
                      domains: values[7],
                      value: ids[7]
                    },
                    {
                      domains: values[8],
                      value: ids[8]
                    },
                    {
                      domains: values[9],
                      value: ids[9]
                    }
                   ];


   AmCharts.ready(function() {
                    // SERIAL CHART
                    chart = new AmCharts.AmSerialChart();
                    chart.autoMarginOffset = 0;
                    chart.marginRight = 0;
                    chart.dataProvider = chartData;
                    chart.categoryField = "domains";
                    // this single line makes the chart a bar chart,
                    // try to set it to false - your bars will turn to columns
                    chart.rotate = true;
                    // the following two lines makes chart 3D
                    chart.depth3D = 20;
                    chart.angle = 30;

                    // AXES
                    // Category
                    var categoryAxis = chart.categoryAxis;
                    categoryAxis.gridPosition = "start";
                    categoryAxis.axisColor = "#DADADA";
                    categoryAxis.fillAlpha = 1;
                    categoryAxis.gridAlpha = 0;
                    categoryAxis.fillColor = "#FAFAFA";

                    // value
                    var valueAxis = new AmCharts.ValueAxis();
                    valueAxis.axisColor = "#DADADA";
                    valueAxis.title = "Domain Pairs (1st Party & 3rd Party) Histogram";
                    valueAxis.gridAlpha = 0.1;
                    chart.addValueAxis(valueAxis);

                    // GRAPH
                    var graph = new AmCharts.AmGraph();
                    graph.title = "Domain Pairs";
                    graph.valueField = "value";
                    graph.type = "column";
                    graph.balloonText = "Domain pairs [[domains]]:[[value]]";
                    graph.lineAlpha = 0;
                    graph.fillColors = "#bf1c25";
                    graph.fillAlphas = 1;
                    chart.addGraph(graph);

                    // WRITE
                    chart.write("chartdiv");
                  });
 })();

/////////////////////////////////////////////////////////////////////////////////
// Set Cookie
/////////////////////////////////////////////////////////////////////////////////
(function setCookie()
 {
   var values2 = CMData.set_cookie_histogram.values;
   var ids = CMData.set_cookie_histogram.id;
   var domain_map2 = CMData.domain_map;

   var chart2;

   // var chartData2 = [{
   //                     domains: domain_map2[ids[0]],
   //                     value: values2[0]
   //                   },
   //                   {
   //                     domains: domain_map2[ids[1]],
   //                     value: values2[1]
   //                   },
   //                   {
   //                     domains: domain_map2[ids[2]],
   //                     value: values2[2]
   //                   },
   //                   {
   //                     domains: domain_map2[ids[3]],
   //                     value: values2[3]
   //                   },
   //                   {
   //                     domains: domain_map2[ids[4]],
   //                     value: values2[4]
   //                   },
   //                   {
   //                     domains: domain_map2[ids[5]],
   //                     value: values2[5]
   //                   },
   //                   {
   //                     domains: domain_map2[ids[6]],
   //                     value: values2[6]
   //                   },
   //                   {
   //                     domains: domain_map2[ids[7]],
   //                     value: values2[7]
   //                   },
   //                   {
   //                     domains: domain_map2[ids[8]],
   //                     value: values2[8]
   //                   },
   //                   {
   //                     domains: domain_map2[ids[9]],
   //                     value: values2[9]
   //                   }
   //                  ];

   var chartData2 = [{
                       domains: values2[0],
                       value: ids[0]
                     },
                     {
                       domains: values2[1],
                       value: ids[1]
                     },
                     {
                       domains: values2[2],
                       value: ids[2]
                     },
                     {
                       domains: values2[3],
                       value: ids[3]
                     },
                     {
                       domains: values2[4],
                       value: ids[4]
                     },
                     {
                       domains: values2[5],
                       value: ids[5]
                     },
                     {
                       domains: values2[6],
                       value: ids[6]
                     },
                     {
                       domains: values2[7],
                       value: ids[7]
                     },
                     {
                       domains: values2[8],
                       value: ids[8]
                     },
                     {
                       domains: values2[9],
                       value: ids[9]
                     }
                    ];



   AmCharts.ready(function() {
                    // SERIAL CHART
                    chart2 = new AmCharts.AmSerialChart();
                    chart2.autoMarginOffset = 0;
                    chart2.marginRight = 0;
                    chart2.dataProvider = chartData2;
                    chart2.categoryField = "domains";
                    // this single line makes the chart a bar chart,
                    // try to set it to false - your bars will turn to columns
                    chart2.rotate = true;
                    // the following two lines makes chart 3D
                    chart2.depth3D = 20;
                    chart2.angle = 30;

                    // AXES
                    // Category
                    var categoryAxis = chart2.categoryAxis;
                    categoryAxis.gridPosition = "start";
                    categoryAxis.axisColor = "#DADADA";
                    categoryAxis.fillAlpha = 1;
                    categoryAxis.gridAlpha = 0;
                    categoryAxis.fillColor = "#FAFAFA";

                    // value
                    var valueAxis = new AmCharts.ValueAxis();
                    valueAxis.axisColor = "#DADADA";
                    valueAxis.title = "Set Cookie Histogram";
                    valueAxis.gridAlpha = 0.1;
                    chart2.addValueAxis(valueAxis);

                    // GRAPH
                    var graph = new AmCharts.AmGraph();
                    graph.title = "Set Cookie";
                    graph.valueField = "value";
                    graph.type = "column";
                    graph.balloonText = "Set Cookie Histogram [[domains]]:[[value]]";
                    graph.lineAlpha = 0;
                    graph.fillColors = "#bf1c25";
                    graph.fillAlphas = 1;
                    chart2.addGraph(graph);

                    // WRITE
                    chart2.write("chartdiv2");
                  });
 })();

/////////////////////////////////////////////////////////////////////////////////
// Expiry Historgram
/////////////////////////////////////////////////////////////////////////////////

(function expiry()
 {
   var values2 = CMData.expiry_histogram.values;
   var ids = CMData.expiry_histogram.id;
   var domain_map2 = CMData.domain_map;

   var chart2;

   var chartData2 = [{
                       domains: values2[0],
                       value: ids[0]
                     },
                     {
                       domains: values2[1],
                       value: ids[1]
                     },
                     {
                       domains: values2[2],
                       value: ids[2]
                     },
                     {
                       domains: values2[3],
                       value: ids[3]
                     },
                     {
                       domains: values2[4],
                       value: ids[4]
                     },
                     {
                       domains: values2[5],
                       value: ids[5]
                     },
                     {
                       domains: values2[6],
                       value: ids[6]
                     },
                     {
                       domains: values2[7],
                       value: ids[7]
                     },
                     {
                       domains: values2[8],
                       value: ids[8]
                     },
                     {
                       domains: values2[9],
                       value: ids[9]
                     }
                    ];


   AmCharts.ready(function() {
                    // SERIAL CHART
                    chart2 = new AmCharts.AmSerialChart();
                    chart2.autoMarginOffset = 0;
                    chart2.marginRight = 0;
                    chart2.dataProvider = chartData2;
                    chart2.categoryField = "domains";
                    // this single line makes the chart a bar chart,
                    // try to set it to false - your bars will turn to columns
                    chart2.rotate = true;
                    // the following two lines makes chart 3D
                    chart2.depth3D = 20;
                    chart2.angle = 30;

                    // AXES
                    // Category
                    var categoryAxis = chart2.categoryAxis;
                    categoryAxis.gridPosition = "start";
                    categoryAxis.axisColor = "#DADADA";
                    categoryAxis.fillAlpha = 1;
                    categoryAxis.gridAlpha = 0;
                    categoryAxis.fillColor = "#FAFAFA";

                    // value
                    var valueAxis = new AmCharts.ValueAxis();
                    valueAxis.axisColor = "#DADADA";
                    valueAxis.title = "Cookie Expiry Histogram";
                    valueAxis.gridAlpha = 0.1;
                    chart2.addValueAxis(valueAxis);

                    // GRAPH
                    var graph = new AmCharts.AmGraph();
                    graph.title = "Cookie Expiry";
                    graph.valueField = "value";
                    graph.type = "column";
                    graph.balloonText = "Cookie Expiry Histogram";
                    graph.lineAlpha = 0;
                    graph.fillColors = "#bf1c25";
                    graph.fillAlphas = 1;
                    chart2.addGraph(graph);

                    // WRITE
                    chart2.write("chartdiv3");
                  });
 })();

////////////
// SOCIAL
////////////
(function socialWidgets() {
   var chart;
   var legend;
   var chartData = CMData.social_widget_loaded;

   AmCharts.ready(function() {
                    // PIE CHART
                    chart = new AmCharts.AmPieChart();
                    chart.dataProvider = chartData;
                    chart.titleField = "widget";
                    chart.valueField = "value";
                    chart.outlineColor = "#FFFFFF";
                    chart.outlineAlpha = 0.8;
                    chart.outlineThickness = 2;
                    // this makes the chart 3D
                    chart.depth3D = 15;
                    chart.angle = 30;

                    // WRITE
                    chart.write("chartdiv4");
                  });
})();

(function shareURLs() {
   var chart;
   var legend;
   var chartData = CMData.share_urls;

   AmCharts.ready(function() {
                    // PIE CHART
                    chart = new AmCharts.AmPieChart();
                    chart.dataProvider = chartData;
                    chart.titleField = "shareURL";
                    chart.valueField = "value";
                    chart.outlineColor = "#FFFFFF";
                    chart.outlineAlpha = 0.8;
                    chart.outlineThickness = 2;
                    // this makes the chart 3D
                    chart.depth3D = 15;
                    chart.angle = 30;

                    // WRITE
                    chart.write("chartdiv5");
                  });
 })();

////////////
// Totals
////////////
$(document).ready(function totals(){
   // var totalEvents = CMData.cookie_data.length;
   var totalUserSessions = CMData.total_user_sessions;
   var totalSocialWidgetsLoaded = 0;
   for (var idx in CMData.social_widget_loaded) {
     totalSocialWidgetsLoaded = totalSocialWidgetsLoaded +
       CMData.social_widget_loaded[idx].value;
   }

   var totalShareURLsLoaded = 0;
   for (var idx in CMData.share_urls) {
     totalShareURLsLoaded = totalShareURLsLoaded +
       CMData.share_urls[idx].value;
   }
   $("#totalUserSessions").text(totalUserSessions);
   // $("#totalCookieEvents").text(totalEvents);
   $("#totalWidgetsLoaded").text(totalSocialWidgetsLoaded);
   $("#totalWidgetsUsed").text(totalShareURLsLoaded);
});
