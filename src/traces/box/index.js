/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

module.exports = {
    attributes: require('./attributes'),
    layoutAttributes: require('./layout_attributes'),
    supplyDefaults: require('./defaults').supplyDefaults,
    crossTraceDefaults: require('./defaults').crossTraceDefaults,
    supplyLayoutDefaults: require('./layout_defaults').supplyLayoutDefaults,
    calc: require('./calc'),
    crossTraceCalc: require('./cross_trace_calc').crossTraceCalc,
    plot: require('./plot').plot,
    style: require('./style').style,
    styleOnSelect: require('./style').styleOnSelect,
    hoverPoints: require('./hover').hoverPoints,
    eventData: require('./event_data'),
    selectPoints: require('./select'),

    moduleType: 'trace',
    name: 'box',
    basePlotModule: require('../../plots/cartesian'),
    categories: ['cartesian', 'svg', 'symbols', 'oriented', 'box-violin', 'showLegend', 'boxLayout', 'zoomScale'],
    meta: {
        description: [
            'In vertical (horizontal) box plots,',
            'statistics are computed using `y` (`x`) values.',

            'By supplying an `x` (`y`) array, one box per distinct x (y) value is drawn',
            'If no `x` (`y`) {array} is provided, a single box is drawn.',
            'In this case, the box is positioned with `name` or with `x0` (`y0`) if provided.',

            'Each box spans from quartile 1 (Q1) to quartile 3 (Q3).',
            'The second quartile (Q2, i.e. the median) is marked by a line inside the box.',
            'By default, the whiskers correspond to the box\' edges',
            '+/- 1.5 times the interquartile range (IQR: Q3-Q1),',
            'see *boxpoints* for other options.',

            'Users can override the computed statistics using attributes',
            '`q1`, `median` and `q3`. Attributes `lowerfence`, `upperfence`, `outliers`,',
            '`mean`, `sd` and `notchspan` can also be used to render the boxes using',
            'precomputed statistics.'
        ].join(' ')
    }
};
