describe('actionCircularize', function () {
    var projection = new sdk.Projection().scale(150);

    // This makes our projection operate like the d3 default of [480,250].
    // https://github.com/d3/d3-geo#projection_translate
    projection.translate([480, 250]);

    function isCircular(id, graph) {
        var points = graph.childNodes(graph.entity(id))
                .map(function (n) { return projection.project(n.loc); }),
            centroid = d3.polygonCentroid(points),
            radius = sdk.vecLength(centroid, points[0]),
            estArea = Math.PI * radius * radius,
            trueArea = Math.abs(d3.polygonArea(points)),
            pctDiff = (estArea - trueArea) / estArea;

        return (pctDiff < 0.025);   // within 2.5% of circular area..
    }

    function intersection(a, b) {
        var seen = a.reduce(function (h, k) {
            h[k] = true;
            return h;
        }, {});

        return b.filter(function (k) {
            var exists = seen[k];
            delete seen[k];
            return exists;
        });
    }

    function angle(point1, point2, center) {
        var vector1 = [point1[0] - center[0], point1[1] - center[1]],
            vector2 = [point2[0] - center[0], point2[1] - center[1]],
            distance;

        distance = sdk.vecLength(vector1, [0, 0]);
        vector1 = [vector1[0] / distance, vector1[1] / distance];

        distance = sdk.vecLength(vector2, [0, 0]);
        vector2 = [vector2[0] / distance, vector2[1] / distance];

        return 180 / Math.PI * Math.acos(vector1[0] * vector2[0] + vector1[1] * vector2[1]);
    }

    function area(id, graph) {
        var points = graph.childNodes(graph.entity(id)).map(function (n) { return n.loc; });
        return d3.polygonArea(points);
    }


    it('creates nodes if necessary', function () {
        //    d ---- c
        //    |      |
        //    a ---- b
        var graph = new Rapid.Graph([
                Rapid.osmNode({id: 'a', loc: [0, 0]}),
                Rapid.osmNode({id: 'b', loc: [2, 0]}),
                Rapid.osmNode({id: 'c', loc: [2, 2]}),
                Rapid.osmNode({id: 'd', loc: [0, 2]}),
                Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'a']})
            ]);

        graph = Rapid.actionCircularize('-', projection)(graph);

        expect(isCircular('-', graph)).to.be.ok;
        expect(graph.entity('-').nodes).to.have.length(20);
    });

    it('reuses existing nodes', function () {
        //    d,e -- c
        //    |      |
        //    a ---- b
        var graph = new Rapid.Graph([
                Rapid.osmNode({id: 'a', loc: [0, 0]}),
                Rapid.osmNode({id: 'b', loc: [2, 0]}),
                Rapid.osmNode({id: 'c', loc: [2, 2]}),
                Rapid.osmNode({id: 'd', loc: [0, 2]}),
                Rapid.osmNode({id: 'e', loc: [0, 2]}),
                Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'e', 'a']})
            ]),
            nodes;

        graph = Rapid.actionCircularize('-', projection)(graph);

        expect(isCircular('-', graph)).to.be.ok;

        nodes = graph.entity('-').nodes;
        expect(nodes).to.contain('a');
        expect(nodes).to.contain('b');
        expect(nodes).to.contain('c');
        expect(nodes).to.contain('d');
        expect(nodes).to.contain('e');
    });

    it('limits movement of nodes that are members of other ways', function () {
        //    b ---- a
        //    |      |
        //    c ---- d
        var graph = new Rapid.Graph([
                Rapid.osmNode({id: 'a', loc: [2, 2]}),
                Rapid.osmNode({id: 'b', loc: [-2, 2]}),
                Rapid.osmNode({id: 'c', loc: [-2, -2]}),
                Rapid.osmNode({id: 'd', loc: [2, -2]}),
                Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'a']}),
                Rapid.osmWay({id: '=', nodes: ['d']})
            ]);

        graph = Rapid.actionCircularize('-', projection)(graph);

        expect(isCircular('-', graph)).to.be.ok;
        expect(sdk.vecLength(graph.entity('d').loc, [2, -2])).to.be.lt(0.5);
    });

    it('creates circle respecting min-angle limit', function() {
        //    d ---- c
        //    |      |
        //    a ---- b
        var graph = new Rapid.Graph([
                Rapid.osmNode({id: 'a', loc: [0, 0]}),
                Rapid.osmNode({id: 'b', loc: [2, 0]}),
                Rapid.osmNode({id: 'c', loc: [2, 2]}),
                Rapid.osmNode({id: 'd', loc: [0, 2]}),
                Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'a']})
            ]),
            centroid, points;

        graph = Rapid.actionCircularize('-', projection, 20)(graph);

        expect(isCircular('-', graph)).to.be.ok;
        points = graph.childNodes(graph.entity('-'))
            .map(function (n) { return projection.project(n.loc); });
        centroid = d3.polygonCentroid(points);

        for (var i = 0; i < points.length - 1; i++) {
            expect(angle(points[i], points[i+1], centroid)).to.be.lte(20);
        }

        expect(angle(points[points.length - 1], points[0], centroid)).to.be.lte(20);
    });

    it('leaves clockwise ways clockwise', function () {
        //    d ---- c
        //    |      |
        //    a ---- b
        var graph = new Rapid.Graph([
                Rapid.osmNode({id: 'a', loc: [0, 0]}),
                Rapid.osmNode({id: 'b', loc: [2, 0]}),
                Rapid.osmNode({id: 'c', loc: [2, 2]}),
                Rapid.osmNode({id: 'd', loc: [0, 2]}),
                Rapid.osmWay({id: '+', nodes: ['a', 'd', 'c', 'b', 'a']})
            ]);

        expect(area('+', graph)).to.be.gt(0);

        graph = Rapid.actionCircularize('+', projection)(graph);

        expect(isCircular('+', graph)).to.be.ok;
        expect(area('+', graph)).to.be.gt(0);
    });

    it('leaves counter-clockwise ways counter-clockwise', function () {
        //    d ---- c
        //    |      |
        //    a ---- b
        var graph = new Rapid.Graph([
                Rapid.osmNode({id: 'a', loc: [0, 0]}),
                Rapid.osmNode({id: 'b', loc: [2, 0]}),
                Rapid.osmNode({id: 'c', loc: [2, 2]}),
                Rapid.osmNode({id: 'd', loc: [0, 2]}),
                Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'a']})
            ]);

        expect(area('-', graph)).to.be.lt(0);

        graph = Rapid.actionCircularize('-', projection)(graph);

        expect(isCircular('-', graph)).to.be.ok;
        expect(area('-', graph)).to.be.lt(0);
    });

    it('adds new nodes on shared way wound in opposite direction', function () {
        //    c ---- b ---- f
        //    |     /       |
        //    |    a        |
        //    |     \       |
        //    d ---- e ---- g
        //
        //  a-b-c-d-e-a is counterclockwise
        //  a-b-f-g-e-a is clockwise
        //
        var graph = new Rapid.Graph([
                Rapid.osmNode({id: 'a', loc: [ 0,  0]}),
                Rapid.osmNode({id: 'b', loc: [ 1,  2]}),
                Rapid.osmNode({id: 'c', loc: [-2,  2]}),
                Rapid.osmNode({id: 'd', loc: [-2, -2]}),
                Rapid.osmNode({id: 'e', loc: [ 1, -2]}),
                Rapid.osmNode({id: 'f', loc: [ 3,  2]}),
                Rapid.osmNode({id: 'g', loc: [ 3, -2]}),
                Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'e', 'a']}),
                Rapid.osmWay({id: '=', nodes: ['a', 'b', 'f', 'g', 'e', 'a']})
            ]);

        expect(intersection(graph.entity('-').nodes, graph.entity('=').nodes).length).to.eql(3);
        expect(graph.entity('-').isConvex(graph)).to.be.false;
        expect(graph.entity('=').isConvex(graph)).to.be.true;

        graph = Rapid.actionCircularize('-', projection)(graph);

        expect(isCircular('-', graph)).to.be.ok;
        expect(intersection(graph.entity('-').nodes, graph.entity('=').nodes).length).to.be.gt(3);
        expect(graph.entity('-').isConvex(graph)).to.be.true;
        expect(graph.entity('=').isConvex(graph)).to.be.false;
    });

    it('adds new nodes on shared way wound in similar direction', function () {
        //    c ---- b ---- f
        //    |     /       |
        //    |    a        |
        //    |     \       |
        //    d ---- e ---- g
        //
        //  a-b-c-d-e-a is counterclockwise
        //  a-e-g-f-b-a is counterclockwise
        //
        var graph = new Rapid.Graph([
                Rapid.osmNode({id: 'a', loc: [ 0,  0]}),
                Rapid.osmNode({id: 'b', loc: [ 1,  2]}),
                Rapid.osmNode({id: 'c', loc: [-2,  2]}),
                Rapid.osmNode({id: 'd', loc: [-2, -2]}),
                Rapid.osmNode({id: 'e', loc: [ 1, -2]}),
                Rapid.osmNode({id: 'f', loc: [ 3,  2]}),
                Rapid.osmNode({id: 'g', loc: [ 3, -2]}),
                Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'e', 'a']}),
                Rapid.osmWay({id: '=', nodes: ['a', 'e', 'g', 'f', 'b', 'a']})
            ]);

        expect(intersection(graph.entity('-').nodes, graph.entity('=').nodes).length).to.eql(3);
        expect(graph.entity('-').isConvex(graph)).to.be.false;
        expect(graph.entity('=').isConvex(graph)).to.be.true;

        graph = Rapid.actionCircularize('-', projection)(graph);

        expect(isCircular('-', graph)).to.be.ok;
        expect(intersection(graph.entity('-').nodes, graph.entity('=').nodes).length).to.be.gt(3);
        expect(graph.entity('-').isConvex(graph)).to.be.true;
        expect(graph.entity('=').isConvex(graph)).to.be.false;
    });

    it('circularizes extremely concave ways with a key node on the wrong side of the centroid', function () {
        //    c ------------ b -- f
        //    |       ___---      |
        //    |  a ===            |
        //    |       ---___      |
        //    d ------------ e -- g
        //
        //  a-b-c-d-e-a is extremely concave and 'a' is to the left of centoid..
        //
        var graph = new Rapid.Graph([
                Rapid.osmNode({id: 'a', loc: [ 0,  0]}),
                Rapid.osmNode({id: 'b', loc: [10,  2]}),
                Rapid.osmNode({id: 'c', loc: [-2,  2]}),
                Rapid.osmNode({id: 'd', loc: [-2, -2]}),
                Rapid.osmNode({id: 'e', loc: [10, -2]}),
                Rapid.osmNode({id: 'f', loc: [15,  2]}),
                Rapid.osmNode({id: 'g', loc: [15, -2]}),
                Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'e', 'a']}),
                Rapid.osmWay({id: '=', nodes: ['a', 'b', 'f', 'g', 'e', 'a']})
            ]);

        expect(graph.entity('-').isConvex(graph)).to.be.false;

        graph = Rapid.actionCircularize('-', projection)(graph);

        expect(isCircular('-', graph)).to.be.ok;
        expect(graph.entity('-').isConvex(graph)).to.be.true;
        expect(graph.entity('-').nodes).to.have.length(20);
    });

    it('not disable circularize when its not circular', function(){
        var graph = new Rapid.Graph([
            Rapid.osmNode({id: 'a', loc: [0, 0]}),
            Rapid.osmNode({id: 'b', loc: [2, 0]}),
            Rapid.osmNode({id: 'c', loc: [2, 2]}),
            Rapid.osmNode({id: 'd', loc: [0, 2]}),
            Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'a']})
        ]);
        var result = Rapid.actionCircularize('-', projection).disabled(graph);
        expect(result).to.be.false;

    });

    it('disable circularize twice', function(){
        var graph = new Rapid.Graph([
            Rapid.osmNode({id: 'a', loc: [0, 0]}),
            Rapid.osmNode({id: 'b', loc: [2, 0]}),
            Rapid.osmNode({id: 'c', loc: [2, 2]}),
            Rapid.osmNode({id: 'd', loc: [0, 2]}),
            Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'a']})
        ]);
        graph = Rapid.actionCircularize('-', projection)(graph);
        var result = Rapid.actionCircularize('-', projection).disabled(graph);
        expect(result).to.eql('already_circular');

    });


    describe('transitions', function () {
        it('is transitionable', function() {
            expect(Rapid.actionCircularize().transitionable).to.be.true;
        });

        it('circularize at t = 0', function() {
            var graph = new Rapid.Graph([
                    Rapid.osmNode({id: 'a', loc: [0, 0]}),
                    Rapid.osmNode({id: 'b', loc: [2, 0]}),
                    Rapid.osmNode({id: 'c', loc: [2, 2]}),
                    Rapid.osmNode({id: 'd', loc: [0, 2]}),
                    Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'a']})
                ]);
            graph = Rapid.actionCircularize('-', projection)(graph, 0);
            expect(isCircular('-', graph)).to.be.not.ok;
            expect(graph.entity('-').nodes).to.have.length(20);
            expect(area('-', graph)).to.be.closeTo(-4, 1e-2);
        });

        it('circularize at t = 0.5', function() {
            var graph = new Rapid.Graph([
                    Rapid.osmNode({id: 'a', loc: [0, 0]}),
                    Rapid.osmNode({id: 'b', loc: [2, 0]}),
                    Rapid.osmNode({id: 'c', loc: [2, 2]}),
                    Rapid.osmNode({id: 'd', loc: [0, 2]}),
                    Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'a']})
                ]);
            graph = Rapid.actionCircularize('-', projection)(graph, 0.5);
            expect(isCircular('-', graph)).to.be.not.ok;
            expect(graph.entity('-').nodes).to.have.length(20);
            expect(area('-', graph)).to.be.closeTo(-4.812, 1e-2);
        });

        it('circularize at t = 1', function() {
            var graph = new Rapid.Graph([
                    Rapid.osmNode({id: 'a', loc: [0, 0]}),
                    Rapid.osmNode({id: 'b', loc: [2, 0]}),
                    Rapid.osmNode({id: 'c', loc: [2, 2]}),
                    Rapid.osmNode({id: 'd', loc: [0, 2]}),
                    Rapid.osmWay({id: '-', nodes: ['a', 'b', 'c', 'd', 'a']})
                ]);
            graph = Rapid.actionCircularize('-', projection)(graph, 1);
            expect(isCircular('-', graph)).to.be.ok;
            expect(graph.entity('-').nodes).to.have.length(20);
            expect(area('-', graph)).to.be.closeTo(-6.168, 1e-2);
        });
    });

});
