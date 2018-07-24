goog.provide('ol.control.Logo');

goog.require('ol');
goog.require('ol.control.Control');
goog.require('ol.css');

/**
 * @classdesc
 * A logo control to show logo.
 * To style this control use css selector `.ol-logo`.
 *
 * @constructor
 * @extends {ol.control.Control}
 * @param {olx.control.LogoOptions=} opt_options Logo options.
 * @api
 */
ol.control.Logo = function (opt_options) {

  var options = opt_options ? opt_options : {};

  var className = options.className !== undefined ? options.className : 'ol-logo';

  var a = document.createElement('a');
  a.className = className + '-a';
  a.href = options.href || 'javascript:';
  var img = document.createElement('img');
  img.className = className + '-img';
  img.src = options.src || '';
  a.appendChild(img);
  var span = document.createElement('span');
  span.className = className + '-span';
  span.innerText = options.attribution || '';

  var cssClasses = className + ' ' + ol.css.CLASS_UNSELECTABLE + ' ' +
    ol.css.CLASS_CONTROL;
  var element = document.createElement('div');
  element.className = cssClasses;
  element.appendChild(a);
  element.appendChild(document.createElement('br'));
  element.appendChild(span);

  ol.control.Control.call(this, {
    element: element,
    render: options.render,
    target: options.target
  });
};
ol.inherits(ol.control.Logo, ol.control.Control);
