describe('Difference', () => {
  describe('constructor', () => {
    it('constructs a Difference between 2 Graphs', () => {
      const node = Rapid.osmNode({ id: 'n' });
      const base = new Rapid.Graph();
      const head = base.replace(node);
      const diff = new Rapid.Difference(base, head);
      expect(diff).to.be.an.instanceOf(Rapid.Difference);
      expect(diff.changes).to.be.an.instanceOf(Map).that.has.all.keys('n');
    });

    it('constructs an empty Difference if base and head are the same', () => {
      const base = new Rapid.Graph();
      const diff = new Rapid.Difference(base, base);
      expect(diff).to.be.an.instanceOf(Rapid.Difference);
      expect(diff.changes).to.be.an.instanceOf(Map).that.is.empty;
    });
  });

  describe('#changes', () => {
    it('includes created entities', () => {
      const node = Rapid.osmNode({ id: 'n' });
      const base = new Rapid.Graph();
      const head = base.replace(node);
      const diff = new Rapid.Difference(base, head);
      expect(diff.changes).to.be.an.instanceOf(Map).that.has.all.keys('n');
      expect(diff.changes.get('n')).to.eql({ base: undefined, head: node });
    });

    it('includes undone created entities', () => {
      const node = Rapid.osmNode({ id: 'n' });
      const base = new Rapid.Graph();
      const head = base.replace(node);
      const diff = new Rapid.Difference(head, base);
      expect(diff.changes).to.be.an.instanceOf(Map).that.has.all.keys('n');
      expect(diff.changes.get('n')).to.eql({ base: node, head: undefined });
    });

    it('includes modified entities', () => {
      const n1 = Rapid.osmNode({ id: 'n' });
      const n2 = n1.update({ tags: { yes: 'no' } });
      const base = new Rapid.Graph([n1]);
      const head = base.replace(n2);
      const diff = new Rapid.Difference(base, head);
      expect(diff.changes).to.be.an.instanceOf(Map).that.has.all.keys('n');
      expect(diff.changes.get('n')).to.eql({ base: n1, head: n2 });
    });

    it('includes undone modified entities', () => {
      const n1 = Rapid.osmNode({ id: 'n' });
      const n2 = n1.update({ tags: { yes: 'no' } });
      const base = new Rapid.Graph([n1]);
      const head = base.replace(n2);
      const diff = new Rapid.Difference(head, base);
      expect(diff.changes).to.be.an.instanceOf(Map).that.has.all.keys('n');
      expect(diff.changes.get('n')).to.eql({ base: n2, head: n1 });
    });

    it('doesn\'t include updated but identical entities', () => {
      const n1 = Rapid.osmNode({ id: 'n' });
      const n2 = n1.update();
      const base = new Rapid.Graph([n1]);
      const head = base.replace(n2);
      const diff = new Rapid.Difference(base, head);
      expect(diff.changes).to.be.empty;
    });

    it('includes deleted entities', () => {
      const node = Rapid.osmNode({ id: 'n' });
      const base = new Rapid.Graph([node]);
      const head = base.remove(node);
      const diff = new Rapid.Difference(base, head);
      expect(diff.changes).to.be.an.instanceOf(Map).that.has.all.keys('n');
      expect(diff.changes.get('n')).to.eql({ base: node, head: undefined });
    });

    it('includes undone deleted entities', () => {
      const node = Rapid.osmNode({ id: 'n' });
      const base = new Rapid.Graph([node]);
      const head = base.remove(node);
      const diff = new Rapid.Difference(head, base);
      expect(diff.changes).to.be.an.instanceOf(Map).that.has.all.keys('n');
      expect(diff.changes.get('n')).to.eql({ base: undefined, head: node });
    });

    it('doesn\'t include created entities that were subsequently deleted', () => {
      const node = Rapid.osmNode();
      const base = new Rapid.Graph();
      const head = base.replace(node).remove(node);
      const diff = new Rapid.Difference(base, head);
      expect(diff.changes).to.be.empty;
    });

    it('doesn\'t include created entities that were subsequently reverted', () => {
      const node = Rapid.osmNode({ id: 'n-1' });
      const base = new Rapid.Graph();
      const head = base.replace(node).revert('n-1');
      const diff = new Rapid.Difference(base, head);
      expect(diff.changes).to.be.empty;
    });

    it('doesn\'t include modified entities that were subsequently reverted', () => {
      const n1 = Rapid.osmNode({ id: 'n' });
      const n2 = n1.update({ tags: { yes: 'no' } });
      const base = new Rapid.Graph([n1]);
      const head = base.replace(n2).revert('n');
      const diff = new Rapid.Difference(base, head);
      expect(diff.changes).to.be.empty;
    });

    it('doesn\'t include deleted entities that were subsequently reverted', () => {
      const node = Rapid.osmNode({ id: 'n' });
      const base = new Rapid.Graph([node]);
      const head = base.remove(node).revert('n');
      const diff = new Rapid.Difference(base, head);
      expect(diff.changes).to.be.empty;
    });
  });


  describe('#created', () => {
    it('returns an array of created entities', () => {
      const node = Rapid.osmNode({ id: 'n' });
      const base = new Rapid.Graph();
      const head = base.replace(node);
      const diff = new Rapid.Difference(base, head);
      expect(diff.created()).to.eql([node]);
    });
  });

  describe('#modified', () => {
    it('returns an array of modified entities', () => {
      const n1 = Rapid.osmNode({ id: 'n' });
      const n2 = n1.move([1, 2]);
      const base = new Rapid.Graph([n1]);
      const head = base.replace(n2);
      const diff = new Rapid.Difference(base, head);
      expect(diff.modified()).to.eql([n2]);
    });
  });

  describe('#deleted', () => {
    it('returns an array of deleted entities', () => {
      const node = Rapid.osmNode({ id: 'n' });
      const base = new Rapid.Graph([node]);
      const head = base.remove(node);
      const diff = new Rapid.Difference(base, head);
      expect(diff.deleted()).to.eql([node]);
    });
  });

  describe('#summary', () => {
    const base = new Rapid.Graph([
      Rapid.osmNode({ id: 'a', tags: { crossing: 'marked' }}),
      Rapid.osmNode({ id: 'b' }),
      Rapid.osmNode({ id: 'v' }),
      Rapid.osmWay({ id: '-', nodes: ['a', 'b']})
    ]);

    it('reports a created way as created', () => {
      const way = Rapid.osmWay({ id: '+' });
      const head = base.replace(way);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('+');
      expect(summary.get('+')).to.eql({ changeType: 'created', entity: way, graph: head });
    });

    it('reports a deleted way as deleted', () => {
      const way = base.entity('-');
      const head = base.remove(way);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('-');
      expect(summary.get('-')).to.eql({ changeType: 'deleted', entity: way, graph: base });
    });

    it('reports a modified way as modified', () => {
      const way = base.entity('-').mergeTags({highway: 'primary' });
      const head = base.replace(way);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('-');
      expect(summary.get('-')).to.eql({ changeType: 'modified', entity: way, graph: head });
    });

    it('reports a way as modified when a member vertex is moved', () => {
      const vertex = base.entity('b').move([0,3]);
      const head = base.replace(vertex);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('-');
      expect(summary.get('-')).to.eql({ changeType: 'modified', entity: head.entity('-'), graph: head });
    });

    it('reports a way as modified when a member vertex is added', () => {
      const vertex = Rapid.osmNode({ id: 'c' });
      const way = base.entity('-').addNode('c');
      const head = base.replace(vertex).replace(way);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('-');
      expect(summary.get('-')).to.eql({ changeType: 'modified', entity: way, graph: head });
    });

    it('reports a way as modified when a member vertex is removed', () => {
      const way = base.entity('-').removeNode('b');
      const head = base.replace(way);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('-');
      expect(summary.get('-')).to.eql({ changeType: 'modified', entity: way, graph: head });
    });

    it('reports a created way containing a moved vertex as being created', () => {
      const vertex = base.entity('b').move([0,3]);
      const way = Rapid.osmWay({ id: '+', nodes: ['b']});
      const head = base.replace(way).replace(vertex);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('+', '-');
      expect(summary.get('+')).to.eql({ changeType: 'created', entity: way, graph: head });
      expect(summary.get('-')).to.eql({ changeType: 'modified', entity: head.entity('-'), graph: head });
    });

    it('reports a created way with a created vertex as being created', () => {
      const vertex = Rapid.osmNode({ id: 'c' });
      const way = Rapid.osmWay({ id: '+', nodes: ['c']});
      const head = base.replace(vertex).replace(way);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('+');
      expect(summary.get('+')).to.eql({ changeType: 'created', entity: way, graph: head });
    });

    it('reports a vertex as modified when it has tags and they are changed', () => {
      const vertex = base.entity('a').mergeTags({highway: 'traffic_signals' });
      const head = base.replace(vertex);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('a');
      expect(summary.get('a')).to.eql({ changeType: 'modified', entity: vertex, graph: head });
    });

    it('reports a vertex as modified when it has tags and is moved', () => {
      const vertex = base.entity('a').move([1, 2]);
      const head = base.replace(vertex);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('-', 'a');
      expect(summary.get('-')).to.eql({ changeType: 'modified', entity: head.entity('-'), graph: head });
      expect(summary.get('a')).to.eql({ changeType: 'modified', entity: vertex, graph: head });
    });

    it('does not report a vertex as modified when it is moved and has no-op tag changes', () => {
      const vertex = base.entity('b').update({tags: {}, loc: [1, 2]});
      const head = base.replace(vertex);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('-');
      expect(summary.get('-')).to.eql({ changeType: 'modified', entity: head.entity('-'), graph: head });
    });

    it('reports a vertex as deleted when it had tags', () => {
      const vertex = base.entity('v');
      const head = base.remove(vertex);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('v');
      expect(summary.get('v')).to.eql({ changeType: 'deleted', entity: vertex, graph: base });
    });

    it('reports a vertex as created when it has tags', () => {
      const vertex = Rapid.osmNode({ id: 'c', tags: {crossing: 'marked' }});
      const way = base.entity('-').addNode('c');
      const head = base.replace(way).replace(vertex);
      const diff = new Rapid.Difference(base, head);
      const summary = diff.summary();
      expect(summary).to.be.an.instanceOf(Map).that.has.all.keys('-', 'c');
      expect(summary.get('-')).to.eql({ changeType: 'modified', entity: way, graph: head });
      expect(summary.get('c')).to.eql({ changeType: 'created', entity: vertex, graph: head });
    });
  });

  describe('#complete', () => {
    it('includes created entities', () => {
      const node = Rapid.osmNode({ id: 'n' });
      const base = new Rapid.Graph();
      const head = base.replace(node);
      const diff = new Rapid.Difference(base, head);
      const complete = diff.complete();
      expect(complete).to.be.an.instanceOf(Map).that.has.all.keys('n');
      expect(complete.get('n')).to.equal(node);
    });

    it('includes modified entities', () => {
      const n1 = Rapid.osmNode({ id: 'n' });
      const n2 = n1.move([1, 2]);
      const base = new Rapid.Graph([n1]);
      const head = base.replace(n2);
      const diff = new Rapid.Difference(base, head);
      const complete = diff.complete();
      expect(complete).to.be.an.instanceOf(Map).that.has.all.keys('n');
      expect(complete.get('n')).to.equal(n2);
    });

    it('includes deleted entities', () => {
      const node = Rapid.osmNode({ id: 'n' });
      const base = new Rapid.Graph([node]);
      const head = base.remove(node);
      const diff = new Rapid.Difference(base, head);
      const complete = diff.complete();
      expect(complete).to.be.an.instanceOf(Map).that.has.all.keys('n');
      expect(complete.get('n')).to.be.undefined;
    });

    it('includes nodes added to a way', () => {
      const n1 = Rapid.osmNode({ id: 'n1' });
      const n2 = Rapid.osmNode({ id: 'n2' });
      const w1 = Rapid.osmWay({ id: 'w', nodes: ['n1']});
      const w2 = w1.addNode('n2');
      const base = new Rapid.Graph([n1, n2, w1]);
      const head = base.replace(w2);
      const diff = new Rapid.Difference(base, head);
      const complete = diff.complete();
      expect(complete).to.be.an.instanceOf(Map).that.has.all.keys('w', 'n1', 'n2');
      expect(complete.get('n2')).to.equal(n2);
    });

    it('includes nodes removed from a way', () => {
      const n1 = Rapid.osmNode({ id: 'n1' });
      const n2 = Rapid.osmNode({ id: 'n2' });
      const w1 = Rapid.osmWay({ id: 'w', nodes: ['n1', 'n2']});
      const w2 = w1.removeNode('n2');
      const base = new Rapid.Graph([n1, n2, w1]);
      const head = base.replace(w2);
      const diff = new Rapid.Difference(base, head);
      const complete = diff.complete();
      expect(complete).to.be.an.instanceOf(Map).that.has.all.keys('w', 'n1', 'n2');
      expect(complete.get('n2')).to.equal(n2);
    });

    it('includes multipolygon members', () => {
      const w1 = Rapid.osmWay({ id: 'w1' });
      const w2 = Rapid.osmWay({ id: 'w2' });
      const r1 = Rapid.osmRelation({
        id: 'r',
        tags: { type: 'multipolygon' },
        members: [{role: 'outer', id: 'w1', type: 'way' }, {role: '', id: 'w2', type: 'way' }]
      });
      const r2 = r1.updateMember({role: 'inner', id: 'w2', type: 'way' }, 1);
      const base = new Rapid.Graph([w1, w2, r1]);
      const head = base.replace(r2);
      const diff = new Rapid.Difference(base, head);
      const complete = diff.complete();
      expect(complete).to.be.an.instanceOf(Map).that.has.all.keys('r', 'w1', 'w2');
      expect(complete.get('w2')).to.equal(w2);
    });

    it('includes parent ways of modified nodes', () => {
      const n1   = Rapid.osmNode({ id: 'n' });
      const n2   = n1.move([1, 2]);
      const way  = Rapid.osmWay({ id: 'w', nodes: ['n']});
      const base = new Rapid.Graph([n1, way]);
      const head = base.replace(n2);
      const diff = new Rapid.Difference(base, head);
      const complete = diff.complete();
      expect(complete).to.be.an.instanceOf(Map).that.has.all.keys('n', 'w');
      expect(complete.get('w')).to.equal(way);
    });

    it('includes parent relations of modified entities', () => {
      const n1   = Rapid.osmNode({ id: 'n' });
      const n2   = n1.move([1, 2]);
      const rel  = Rapid.osmRelation({ id: 'r', members: [{ id: 'n' }]});
      const base = new Rapid.Graph([n1, rel]);
      const head = base.replace(n2);
      const diff = new Rapid.Difference(base, head);
      const complete = diff.complete();
      expect(complete).to.be.an.instanceOf(Map).that.has.all.keys('n', 'r');
      expect(complete.get('r')).to.equal(rel);
    });

    it('includes parent relations of modified entities, recursively', () => {
      const n1   = Rapid.osmNode({ id: 'n' });
      const n2   = n1.move([1, 2]);
      const rel1 = Rapid.osmRelation({ id: 'r1', members: [{ id: 'n' }]});
      const rel2 = Rapid.osmRelation({ id: 'r2', members: [{ id: 'r1' }]});
      const base = new Rapid.Graph([n1, rel1, rel2]);
      const head = base.replace(n2);
      const diff = new Rapid.Difference(base, head);
      const complete = diff.complete();
      expect(complete).to.be.an.instanceOf(Map).that.has.all.keys('n', 'r1', 'r2');
      expect(complete.get('r2')).to.equal(rel2);
    });

    it('includes parent relations of parent ways of modified nodes', () => {
      const n1   = Rapid.osmNode({ id: 'n' });
      const n2   = n1.move([1, 2]);
      const way  = Rapid.osmWay({ id: 'w', nodes: ['n']});
      const rel  = Rapid.osmRelation({ id: 'r', members: [{ id: 'w' }]});
      const base = new Rapid.Graph([n1, way, rel]);
      const head = base.replace(n2);
      const diff = new Rapid.Difference(base, head);
      const complete = diff.complete();
      expect(complete).to.be.an.instanceOf(Map).that.has.all.keys('n', 'w', 'r');
      expect(complete.get('r')).to.equal(rel);
    });

    it('copes with recursive relations', () => {
      const node = Rapid.osmNode({ id: 'n' });
      const rel1 = Rapid.osmRelation({ id: 'r1', members: [{ id: 'n' }, { id: 'r2' }]});
      const rel2 = Rapid.osmRelation({ id: 'r2', members: [{ id: 'r1' }]});
      const base = new Rapid.Graph([node, rel1, rel2]);
      const head = base.replace(node.move([1, 2]));
      const diff = new Rapid.Difference(base, head);
      const complete = diff.complete();
      expect(complete).to.be.an.instanceOf(Map).that.has.all.keys('n', 'r1', 'r2');
    });

  });
});
