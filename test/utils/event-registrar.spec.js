// Copyright (c) 2017 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import test from 'tape-catch';
import EventRegistrar from 'mjolnir.js/utils/event-registrar';
import {createEventRegistrarMock} from '../test-utils';

test('EventRegistrar#add, remove', t => {
  const eventRegistrar = new EventRegistrar();
  const handler1 = () => {};
  const handler2 = () => {};

  t.ok(eventRegistrar.handlers, 'event handler is created');
  t.ok(eventRegistrar.isEmpty(), 'event handler is empty');
  t.is(eventRegistrar.handlersByElement.size, 0, 'event elements map is empty');

  eventRegistrar.add('click', handler1);

  t.notOk(eventRegistrar.isEmpty(), 'event handler is not empty');
  t.is(eventRegistrar.handlers.length, 1, 'event handler is added');
  t.deepEquals(
    eventRegistrar.handlers[0],
    {type: 'click', handler: handler1, srcElement: 'root'},
    'event handler is added'
  );
  t.deepEquals(
    eventRegistrar.handlersByElement.get('root'),
    [{type: 'click', handler: handler1, srcElement: 'root'}],
    'event elements map is updated'
  );

  eventRegistrar.add('click', handler2, 'child-0');

  t.is(eventRegistrar.handlers.length, 2, 'event handler is added');
  t.deepEquals(
    eventRegistrar.handlers[1],
    {type: 'click', handler: handler2, srcElement: 'child-0'},
    'event handler is added'
  );
  t.deepEquals(
    eventRegistrar.handlersByElement.get('child-0'),
    [{type: 'click', handler: handler2, srcElement: 'child-0'}],
    'event elements map is updated'
  );

  eventRegistrar.remove('click', handler1);

  t.is(eventRegistrar.handlers.length, 1, 'event handler is removed');
  t.deepEquals(
    eventRegistrar.handlers[0],
    {type: 'click', handler: handler2, srcElement: 'child-0'},
    'event handler is removed'
  );
  t.notOk(eventRegistrar.handlersByElement.has('root'), 'event elements map is updated');

  eventRegistrar.remove('click', handler2);

  t.ok(eventRegistrar.isEmpty(), 'event handler is empty');
  t.notOk(eventRegistrar.handlersByElement.has('child-0'), 'event elements map is updated');

  t.end();
});

test('EventRegistrar#normalizeEvent', t => {
  const elementMock = createEventRegistrarMock();
  const eventMock = {
    type: 'foo',
    srcEvent: {
      clientX: 0,
      clientY: 0,
      target: {}
    }
  };

  let normalizedEvent;
  const eventRegistrar = new EventRegistrar({element: elementMock});
  eventRegistrar.add('foo', evt => {
    normalizedEvent = evt;
  });

  eventRegistrar.handleEvent(eventMock);

  t.is(normalizedEvent.rootElement, elementMock, 'rootElement is set');
  t.ok(normalizedEvent.center, 'center is populated');
  t.ok(normalizedEvent.offsetCenter, 'offsetCenter is populated');
  t.is(normalizedEvent.handled, false, 'event marked as not handled');
  t.is(typeof normalizedEvent.stopPropagation, 'function', 'event.stopPropagation is a function');
  t.is(typeof normalizedEvent.stopImmediatePropagation, 'function',
    'event.stopImmediatePropagation is a function');

  t.end();
});

test('EventRegistrar#propagation', t => {
  const rootNode = createEventRegistrarMock({
    id: 'root', children: [
      {id: 'child-0', children: [
        {id: 'grandchild-00'},
        {id: 'grandchild-01'}
      ]},
      {id: 'child-1'}
    ]
  });
  const eventRegistrar = new EventRegistrar({element: rootNode});

  const handlerCalls = [];

  const fooHandler = (message, stopPropagation = false) => evt => {
    handlerCalls.push(message);
    if (stopPropagation) {
      evt.stopPropagation();
    }
  };

  // Should not be called (propagation stopped)
  eventRegistrar.add('foo', fooHandler('foo@root'));
  // Should be called
  eventRegistrar.add('foo', fooHandler('foo@child-0', true), rootNode.find('child-0'));
  eventRegistrar.add('foo', fooHandler('foo@grandchild-00'), rootNode.find('grandchild-00'));
  eventRegistrar.add('foo', fooHandler('foo@child-0:2'), rootNode.find('child-0'));
  // Should not be called (not on propagation path)
  eventRegistrar.add('foo', fooHandler('foo@grandchild-01'), rootNode.find('grandchild-01'));

  const eventMock = {
    type: 'foo',
    srcEvent: {
      target: rootNode.find('grandchild-00')
    }
  };
  eventRegistrar.handleEvent(eventMock);

  t.deepEquals(handlerCalls, ['foo@grandchild-00', 'foo@child-0', 'foo@child-0:2'],
    'propagated correctly');
  t.end();

});
