/**
* Copyright 2012-2019, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var isNumeric = require('fast-isnumeric');

var Axes = require('../../plots/cartesian/axes');
var Lib = require('../../lib');

var BADNUM = require('../../constants/numerical').BADNUM;
var _ = Lib._;

// outlier definition based on http://www.physics.csbsju.edu/stats/box2.html
module.exports = function calc(gd, trace) {
    var fullLayout = gd._fullLayout;
    var xa = Axes.getFromId(gd, trace.xaxis || 'x');
    var ya = Axes.getFromId(gd, trace.yaxis || 'y');
    var cd = [];

    // N.B. violin reuses same Box.calc
    var numKey = trace.type === 'violin' ? '_numViolins' : '_numBoxes';

    var i, j;
    var valAxis, valLetter;
    var posAxis, posLetter;

    if(trace.orientation === 'h') {
        valAxis = xa;
        valLetter = 'x';
        posAxis = ya;
        posLetter = 'y';
    } else {
        valAxis = ya;
        valLetter = 'y';
        posAxis = xa;
        posLetter = 'x';
    }

    var posArray = getPos(trace, posLetter, posAxis, fullLayout[numKey]);
    var dv = Lib.distinctVals(posArray);
    var posDistinct = dv.vals;
    var dPos = dv.minDiff / 2;

    // item in trace calcdata
    var cdi;
    // single sample point
    var pt;
    // single sample value
    var v;

    if(trace._hasPreCompStats) {
        var d2c = function(k) { return valAxis.d2c((trace[k] || [])[i]); };
        var minVal = Infinity;
        var maxVal = -Infinity;

        for(i = 0; i < trace._length; i++) {
            var posi = posArray[i];
            if(!isNumeric(posi)) continue;

            cdi = {};
            cdi.pos = cdi[posLetter] = posi;

            cdi.q1 = d2c('q1');
            cdi.med = d2c('median');
            cdi.q3 = d2c('q3');

            // pts2 is for plot (filtered set)
            // pts is for hover/select (unfiltered set)
            var pts2 = cdi.pts2 = cdi.pts = [];
            if(trace.outliers && Lib.isArrayOrTypedArray(trace.outliers[i])) {
                for(j = 0; j < trace.outliers[i].length; j++) {
                    v = valAxis.d2c(trace.outliers[i][j]);
                    // TODO text/hovertext would have to be 2d to match
                    //      outlier points
                    // arraysToCalcdata(pt, trace, j);
                    if(v !== BADNUM) cdi.pts2.push({v: v, i: i});
                }
                cdi.pts2.sort(sortByVal);
            }

            if(cdi.med !== BADNUM && cdi.q1 !== BADNUM && cdi.q3 !== BADNUM &&
                cdi.med >= cdi.q1 && cdi.q3 >= cdi.med
            ) {
                var lf = d2c('lowerfence');
                cdi.lf = (lf !== BADNUM && lf <= cdi.q1) ? lf : cdi.q1;

                var uf = d2c('upperfence');
                cdi.uf = (uf !== BADNUM && uf >= cdi.q3) ? uf : cdi.q3;

                cdi.mean = d2c('mean');
                cdi.sd = d2c('sd');

                var ns = d2c('notchspan');
                ns = (ns !== BADNUM && ns > 0) ? ns : 0;
                cdi.ln = cdi.med - ns;
                cdi.un = cdi.med + ns;

                var imin = cdi.lf;
                var imax = cdi.uf;
                if(trace.boxpoints && pts2.length) {
                    imin = Math.min(imin, pts2[0].v);
                    imax = Math.max(imax, pts2[pts2.length - 1].v);
                }
                if(trace.notched) {
                    imin = Math.min(imin, cdi.ln);
                    imax = Math.max(imax, cdi.un);
                }
                cdi.min = imin;
                cdi.max = imax;

                // TODO do we need these
                // lo ?
                // uo ?
                // [valLetter] ?
            } else {
                Lib.warn('Invalid input - make sure that q1 <= median <= q3');

                var v0;
                if(cdi.med !== BADNUM) {
                    v0 = cdi.med;
                } else if(cdi.q1 !== BADNUM) {
                    if(cdi.q3 !== BADNUM) v0 = (cdi.q1 + cdi.q3) / 2;
                    else v0 = cdi.q1;
                } else if(cdi.q3 !== BADNUM) {
                    v0 = cdi.q3;
                } else {
                    v0 = 0;
                }

                // draw box as line segment
                cdi.med = v0;
                cdi.q1 = cdi.q3 = v0;
                cdi.lf = cdi.uf = v0;
                cdi.mean = cdi.sd = v0;
                cdi.ln = cdi.un = v0;
                cdi.min = cdi.max = v0;
            }

            minVal = Math.min(minVal, cdi.min);
            maxVal = Math.max(maxVal, cdi.max);

            cd.push(cdi);
        }

        trace._extremes[valAxis._id] = Axes.findExtremes(valAxis,
            [minVal, maxVal],
            {padded: true}
        );

        // TODO how would this work ???
        // calcSelection(cd, trace);
    } else {
        var valArray = valAxis.makeCalcdata(trace, valLetter);
        var posBins = makeBins(posDistinct, dPos);
        var pLen = posDistinct.length;
        var ptsPerBin = initNestedArray(pLen);

        // bin pts info per position bins
        for(i = 0; i < trace._length; i++) {
            v = valArray[i];
            if(!isNumeric(v)) continue;

            var n = Lib.findBin(posArray[i], posBins);
            if(n >= 0 && n < pLen) {
                pt = {v: v, i: i};
                arraysToCalcdata(pt, trace, i);
                ptsPerBin[n].push(pt);
            }
        }

        var ptFilterFn = (trace.boxpoints || trace.points) === 'all' ?
            Lib.identity :
            function(pt) { return (pt.v < cdi.lf || pt.v > cdi.uf); };

        var minLowerNotch = Infinity;
        var maxUpperNotch = -Infinity;

        // build calcdata trace items, one item per distinct position
        for(i = 0; i < pLen; i++) {
            if(ptsPerBin[i].length > 0) {
                var pts = ptsPerBin[i].sort(sortByVal);
                var boxVals = pts.map(extractVal);
                var N = boxVals.length;

                cdi = {};
                cdi.pos = posDistinct[i];
                cdi.pts = pts;

                // Sort categories by values
                cdi[posLetter] = cdi.pos;
                cdi[valLetter] = cdi.pts.map(extractVal);

                cdi.min = boxVals[0];
                cdi.max = boxVals[N - 1];
                cdi.mean = Lib.mean(boxVals, N);
                cdi.sd = Lib.stdev(boxVals, N, cdi.mean);

                // median
                cdi.med = Lib.interp(boxVals, 0.5);

                var quartilemethod = trace.quartilemethod;

                if((N % 2) && (quartilemethod === 'exclusive' || quartilemethod === 'inclusive')) {
                    var lower;
                    var upper;

                    if(quartilemethod === 'exclusive') {
                        // do NOT include the median in either half
                        lower = boxVals.slice(0, N / 2);
                        upper = boxVals.slice(N / 2 + 1);
                    } else if(quartilemethod === 'inclusive') {
                        // include the median in either half
                        lower = boxVals.slice(0, N / 2 + 1);
                        upper = boxVals.slice(N / 2);
                    }

                    cdi.q1 = Lib.interp(lower, 0.5);
                    cdi.q3 = Lib.interp(upper, 0.5);
                } else {
                    cdi.q1 = Lib.interp(boxVals, 0.25);
                    cdi.q3 = Lib.interp(boxVals, 0.75);
                }

                // lower and upper fences - last point inside
                // 1.5 interquartile ranges from quartiles
                cdi.lf = Math.min(
                    cdi.q1,
                    boxVals[Math.min(
                        Lib.findBin(2.5 * cdi.q1 - 1.5 * cdi.q3, boxVals, true) + 1,
                        N - 1
                    )]
                );
                cdi.uf = Math.max(
                    cdi.q3,
                    boxVals[Math.max(
                        Lib.findBin(2.5 * cdi.q3 - 1.5 * cdi.q1, boxVals),
                        0
                    )]
                );

                // lower and upper outliers - 3 IQR out (don't clip to max/min,
                // this is only for discriminating suspected & far outliers)
                cdi.lo = 4 * cdi.q1 - 3 * cdi.q3;
                cdi.uo = 4 * cdi.q3 - 3 * cdi.q1;

                // lower and upper notches ~95% Confidence Intervals for median
                var iqr = cdi.q3 - cdi.q1;
                var mci = 1.57 * iqr / Math.sqrt(N);
                cdi.ln = cdi.med - mci;
                cdi.un = cdi.med + mci;
                minLowerNotch = Math.min(minLowerNotch, cdi.ln);
                maxUpperNotch = Math.max(maxUpperNotch, cdi.un);

                cdi.pts2 = pts.filter(ptFilterFn);

                cd.push(cdi);
            }
        }

        trace._extremes[valAxis._id] = Axes.findExtremes(valAxis,
            trace.notched ? valArray.concat([minLowerNotch, maxUpperNotch]) : valArray,
            {padded: true}
        );

        calcSelection(cd, trace);
    }

    if(cd.length > 0) {
        cd[0].t = {
            num: fullLayout[numKey],
            dPos: dPos,
            posLetter: posLetter,
            valLetter: valLetter,
            labels: {
                med: _(gd, 'median:'),
                min: _(gd, 'min:'),
                q1: _(gd, 'q1:'),
                q3: _(gd, 'q3:'),
                max: _(gd, 'max:'),
                mean: trace.boxmean === 'sd' ? _(gd, 'mean ± σ:') : _(gd, 'mean:'),
                lf: _(gd, 'lower fence:'),
                uf: _(gd, 'upper fence:')
            }
        };

        fullLayout[numKey]++;
        return cd;
    } else {
        return [{t: {empty: true}}];
    }
};

// In vertical (horizontal) box plots:
// if no x (y) data, use x0 (y0), or name
// so if you want one box
// per trace, set x0 (y0) to the x (y) value or category for this trace
// (or set x (y) to a constant array matching y (x))
function getPos(trace, posLetter, posAxis, num) {
    if(posLetter in trace) {
        return posAxis.makeCalcdata(trace, posLetter);
    }

    var pos0;

    if(posLetter + '0' in trace) {
        pos0 = trace[posLetter + '0'];
    } else if('name' in trace && (
        posAxis.type === 'category' || (
            isNumeric(trace.name) &&
            ['linear', 'log'].indexOf(posAxis.type) !== -1
        ) || (
            Lib.isDateTime(trace.name) &&
            posAxis.type === 'date'
        )
    )) {
        pos0 = trace.name;
    } else {
        pos0 = num;
    }

    var pos0c = posAxis.type === 'multicategory' ?
        posAxis.r2c_just_indices(pos0) :
        posAxis.d2c(pos0, 0, trace[posLetter + 'calendar']);

    var len = trace._length;
    var out = new Array(len);
    for(var i = 0; i < len; i++) out[i] = pos0c;

    return out;
}

function makeBins(x, dx) {
    var len = x.length;
    var bins = new Array(len + 1);

    for(var i = 0; i < len; i++) {
        bins[i] = x[i] - dx;
    }
    bins[len] = x[len - 1] + dx;

    return bins;
}

function initNestedArray(len) {
    var arr = new Array(len);
    for(var i = 0; i < len; i++) {
        arr[i] = [];
    }
    return arr;
}

function arraysToCalcdata(pt, trace, i) {
    var trace2calc = {
        text: 'tx',
        hovertext: 'htx'
    };

    for(var k in trace2calc) {
        if(Array.isArray(trace[k])) {
            pt[trace2calc[k]] = trace[k][i];
        }
    }
}

function calcSelection(cd, trace) {
    if(Lib.isArrayOrTypedArray(trace.selectedpoints)) {
        for(var i = 0; i < cd.length; i++) {
            var pts = cd[i].pts || [];
            var ptNumber2cdIndex = {};

            for(var j = 0; j < pts.length; j++) {
                ptNumber2cdIndex[pts[j].i] = j;
            }

            Lib.tagSelected(pts, trace, ptNumber2cdIndex);
        }
    }
}

function sortByVal(a, b) { return a.v - b.v; }

function extractVal(o) { return o.v; }
