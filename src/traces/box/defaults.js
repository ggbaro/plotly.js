/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var Lib = require('../../lib');
var Registry = require('../../registry');
var Color = require('../../components/color');
var handleGroupingDefaults = require('../bar/defaults').handleGroupingDefaults;
var attributes = require('./attributes');

function supplyDefaults(traceIn, traceOut, defaultColor, layout) {
    function coerce(attr, dflt) {
        return Lib.coerce(traceIn, traceOut, attributes, attr, dflt);
    }

    handleSampleDefaults(traceIn, traceOut, coerce, layout);
    if(traceOut.visible === false) return;

    var hasPreCompStats = traceOut._hasPreCompStats;

    if(hasPreCompStats) {
        coerce('lowerfence');
        coerce('upperfence');
    }

    coerce('line.color', (traceIn.marker || {}).color || defaultColor);
    coerce('line.width');
    coerce('fillcolor', Color.addOpacity(traceOut.line.color, 0.5));

    var boxmeanDflt;
    if(hasPreCompStats) {
        var mean = coerce('mean');
        var sd = coerce('sd');
        if(mean && mean.length) {
            boxmeanDflt = true;
            if(sd && sd.length) boxmeanDflt = 'sd';
        }
    }
    coerce('boxmean', boxmeanDflt);

    coerce('whiskerwidth');
    coerce('width');
    coerce('quartilemethod');

    var notchedDflt;
    if(hasPreCompStats) {
        var notchspan = coerce('notchspan');
        if(notchspan && notchspan.length) {
            notchedDflt = true;
        }
    } else if(Lib.validate(traceIn.notchwidth, attributes.notchwidth)) {
        notchedDflt = true;
    }
    var notched = coerce('notched', notchedDflt);
    if(notched) coerce('notchwidth');

    handlePointsDefaults(traceIn, traceOut, coerce, {prefix: 'box'});
}

function handleSampleDefaults(traceIn, traceOut, coerce, layout) {
    var y = coerce('y');
    var x = coerce('x');
    var hasY = y && y.length;
    var hasX = x && x.length;

    var q1, median, q3;
    if(traceOut.type === 'box') {
        q1 = coerce('q1');
        median = coerce('median');
        q3 = coerce('q3');

        traceOut._hasPreCompStats = (
            q1 && q1.length &&
            median && median.length &&
            q3 && q3.length
        );
    }

    var defaultOrientation, len;

    if(traceOut._hasPreCompStats) {
        if(hasX) {
            defaultOrientation = 'v';
            len = Math.min(Lib.minRowLength(x),
                Lib.minRowLength(q1), Lib.minRowLength(median), Lib.minRowLength(q3));
        } else if(hasY) {
            defaultOrientation = 'h';
            len = Math.min(Lib.minRowLength(y),
                Lib.minRowLength(q1), Lib.minRowLength(median), Lib.minRowLength(q3));
        } else {
            len = 0;

            // TODO could coerce x0/dx OR y0/dy !
        }
    } else {
        if(hasY) {
            defaultOrientation = 'v';
            if(hasX) {
                len = Math.min(Lib.minRowLength(x), Lib.minRowLength(y));
            } else {
                coerce('x0');
                len = Lib.minRowLength(y);
            }
        } else if(hasX) {
            defaultOrientation = 'h';
            coerce('y0');
            len = Lib.minRowLength(x);
        } else {
            len = 0;
        }
    }

    if(!len) {
        traceOut.visible = false;
        return;
    }

    traceOut._length = len;

    var handleCalendarDefaults = Registry.getComponentMethod('calendars', 'handleTraceDefaults');
    handleCalendarDefaults(traceIn, traceOut, ['x', 'y'], layout);

    coerce('orientation', defaultOrientation);
}

function handlePointsDefaults(traceIn, traceOut, coerce, opts) {
    var prefix = opts.prefix;

    var modeDflt;
    if(traceOut._hasPreCompStats) {
        var outliers = coerce('outliers');
        modeDflt = (outliers && Lib.isArrayOrTypedArray(outliers)) ? 'outliers' : false;
    } else {
        var outlierColorDflt = Lib.coerce2(traceIn, traceOut, attributes, 'marker.outliercolor');
        var lineoutliercolor = coerce('marker.line.outliercolor');
        if(outlierColorDflt || lineoutliercolor) modeDflt = 'suspectedoutliers';
    }

    var mode = coerce(prefix + 'points', modeDflt);

    if(traceOut._hasPreCompStats && (mode !== false || mode === 'outliers')) {
        traceOut[prefix + 'points'] = 'outliers';
    }

    if(mode) {
        coerce('jitter', mode === 'all' ? 0.3 : 0);
        coerce('pointpos', mode === 'all' ? -1.5 : 0);

        coerce('marker.symbol');
        coerce('marker.opacity');
        coerce('marker.size');
        coerce('marker.color', traceOut.line.color);
        coerce('marker.line.color');
        coerce('marker.line.width');

        if(mode === 'suspectedoutliers') {
            coerce('marker.line.outliercolor', traceOut.marker.color);
            coerce('marker.line.outlierwidth');
        }

        coerce('selected.marker.color');
        coerce('unselected.marker.color');
        coerce('selected.marker.size');
        coerce('unselected.marker.size');

        coerce('text');
        coerce('hovertext');
    } else {
        delete traceOut.marker;
    }

    var hoveron = coerce('hoveron');
    if(hoveron === 'all' || hoveron.indexOf('points') !== -1) {
        coerce('hovertemplate');
    }

    Lib.coerceSelectionMarkerOpacity(traceOut, coerce);
}

function crossTraceDefaults(fullData, fullLayout) {
    var traceIn, traceOut;

    function coerce(attr) {
        return Lib.coerce(traceOut._input, traceOut, attributes, attr);
    }

    for(var i = 0; i < fullData.length; i++) {
        traceOut = fullData[i];
        var traceType = traceOut.type;

        if(traceType === 'box' || traceType === 'violin') {
            traceIn = traceOut._input;
            if(fullLayout[traceType + 'mode'] === 'group') {
                handleGroupingDefaults(traceIn, traceOut, fullLayout, coerce);
            }
        }
    }
}

module.exports = {
    supplyDefaults: supplyDefaults,
    crossTraceDefaults: crossTraceDefaults,

    handleSampleDefaults: handleSampleDefaults,
    handlePointsDefaults: handlePointsDefaults
};
