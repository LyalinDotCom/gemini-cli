/**
 * Tree Renderer Component
 *
 * Renders the serialized component tree received from the WebSocket reconciler.
 * Maps Ink components (ink-box, ink-text) to web elements.
 */

import React, { useMemo } from 'react';

// Types matching the server's serialized format
interface SerializedElement {
  id: string;
  type: string;
  props: Record<string, unknown>;
  parentId: string | null;
  children: (SerializedElement | SerializedTextNode)[];
}

interface SerializedTextNode {
  id: string;
  type: 'text';
  value: string;
  parentId: string | null;
}

type SerializedNode = SerializedElement | SerializedTextNode;

interface TreeRendererProps {
  tree: SerializedElement | null;
}

/**
 * Convert Ink props to CSS styles
 */
function toCh(value: number | string | undefined): string | undefined {
  if (typeof value === 'number') return `${value}ch`;
  if (typeof value === 'string') return value;
  return undefined;
}

function toEm(value: number | string | undefined): string | undefined {
  if (typeof value === 'number') return `${value}em`;
  if (typeof value === 'string') return value;
  return undefined;
}

function inkPropsToStyle(props: Record<string, unknown>): React.CSSProperties {
  const style: React.CSSProperties = {};

  // Flex direction
  if (props.flexDirection === 'column') {
    style.flexDirection = 'column';
  } else if (props.flexDirection === 'row' || props.flexDirection === 'row-reverse') {
    style.flexDirection = props.flexDirection as 'row' | 'row-reverse';
  }

  // Flex properties
  if (typeof props.flexGrow === 'number') style.flexGrow = props.flexGrow;
  if (typeof props.flexShrink === 'number') style.flexShrink = props.flexShrink;
  if (typeof props.flexBasis === 'number' || typeof props.flexBasis === 'string') {
    style.flexBasis = props.flexBasis as string | number;
  }
  if (typeof props.flex === 'number') style.flex = props.flex;

  // Alignment
  if (props.alignItems) style.alignItems = props.alignItems as string;
  if (props.alignSelf) style.alignSelf = props.alignSelf as string;
  if (props.justifyContent) style.justifyContent = props.justifyContent as string;

  // Dimensions
  style.width = toCh(props.width as number | string | undefined);
  style.minWidth = toCh(props.minWidth as number | string | undefined);
  style.maxWidth = toCh(props.maxWidth as number | string | undefined);
  style.height = toEm(props.height as number | string | undefined);
  style.minHeight = toEm(props.minHeight as number | string | undefined);
  style.maxHeight = toEm(props.maxHeight as number | string | undefined);

  // Margin
  if (typeof props.margin === 'number') style.margin = `${props.margin}ch`;
  if (typeof props.marginTop === 'number') style.marginTop = `${props.marginTop}em`;
  if (typeof props.marginBottom === 'number') style.marginBottom = `${props.marginBottom}em`;
  if (typeof props.marginLeft === 'number') style.marginLeft = `${props.marginLeft}ch`;
  if (typeof props.marginRight === 'number') style.marginRight = `${props.marginRight}ch`;
  if (typeof props.marginX === 'number') {
    style.marginLeft = `${props.marginX}ch`;
    style.marginRight = `${props.marginX}ch`;
  }
  if (typeof props.marginY === 'number') {
    style.marginTop = `${props.marginY}em`;
    style.marginBottom = `${props.marginY}em`;
  }

  // Padding
  if (typeof props.padding === 'number') style.padding = `${props.padding}ch`;
  if (typeof props.paddingTop === 'number') style.paddingTop = `${props.paddingTop}em`;
  if (typeof props.paddingBottom === 'number') style.paddingBottom = `${props.paddingBottom}em`;
  if (typeof props.paddingLeft === 'number') style.paddingLeft = `${props.paddingLeft}ch`;
  if (typeof props.paddingRight === 'number') style.paddingRight = `${props.paddingRight}ch`;
  if (typeof props.paddingX === 'number') {
    style.paddingLeft = `${props.paddingX}ch`;
    style.paddingRight = `${props.paddingX}ch`;
  }
  if (typeof props.paddingY === 'number') {
    style.paddingTop = `${props.paddingY}em`;
    style.paddingBottom = `${props.paddingY}em`;
  }

  // Border
  if (props.borderStyle) {
    style.border = '1px solid currentColor';
    if (props.borderStyle === 'round') {
      style.borderRadius = '8px';
    }
  }
  if (props.borderColor) {
    style.borderColor = props.borderColor as string;
  }

  // Overflow
  if (props.overflow) {
    style.overflow = props.overflow as 'visible' | 'hidden';
  }

  // Gap
  if (typeof props.gap === 'number') style.gap = `${props.gap}ch`;

  return style;
}

/**
 * Convert Ink text props to CSS styles
 */
function inkTextPropsToStyle(props: Record<string, unknown>): React.CSSProperties {
  const style: React.CSSProperties = {};

  // Text color
  if (props.color) {
    style.color = mapInkColor(props.color as string);
  }

  // Background color
  if (props.backgroundColor) {
    style.backgroundColor = mapInkColor(props.backgroundColor as string);
  }

  // Font weight
  if (props.bold) {
    style.fontWeight = 'bold';
  }

  // Font style
  if (props.italic) {
    style.fontStyle = 'italic';
  }

  // Text decoration
  if (props.underline) {
    style.textDecoration = 'underline';
  }
  if (props.strikethrough) {
    style.textDecoration = 'line-through';
  }

  // Dim text
  if (props.dimColor) {
    style.opacity = 0.5;
  }

  // Wrap
  if (props.wrap === 'truncate') {
    style.overflow = 'hidden';
    style.textOverflow = 'ellipsis';
    style.whiteSpace = 'nowrap';
  } else if (props.wrap === 'truncate-end') {
    style.overflow = 'hidden';
    style.textOverflow = 'ellipsis';
    style.whiteSpace = 'nowrap';
  }

  return style;
}

/**
 * Map Ink color names to CSS colors
 */
function mapInkColor(color: string): string {
  const colorMap: Record<string, string> = {
    black: '#000000',
    red: '#ff0000',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#0066ff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#ffffff',
    gray: '#808080',
    grey: '#808080',
    blackBright: '#404040',
    redBright: '#ff6666',
    greenBright: '#66ff66',
    yellowBright: '#ffff66',
    blueBright: '#6699ff',
    magentaBright: '#ff66ff',
    cyanBright: '#66ffff',
    whiteBright: '#ffffff',
  };

  return colorMap[color] || color;
}

/**
 * Render a single node
 */
function RenderNode({ node }: { node: SerializedNode }): React.ReactElement | null {
  // Handle text nodes
  if (node.type === 'text') {
    return <>{(node as SerializedTextNode).value}</>;
  }

  const element = node as SerializedElement;
  const { type, props, children, id } = element;

  // Render children
  const renderedChildren = children.map((child, index) => (
    <RenderNode key={child.id || index} node={child} />
  ));

  // Map Ink components to web elements
  switch (type) {
    case 'ws-root':
      return (
        <div className="ws-root" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {renderedChildren}
        </div>
      );

    case 'ink-box':
      return (
        <div
          className="ink-box"
          style={{
            display: 'flex',
            ...inkPropsToStyle(props),
          }}
        >
          {renderedChildren}
        </div>
      );

    case 'ink-text':
      return (
        <span className="ink-text" style={inkTextPropsToStyle(props)}>
          {renderedChildren}
        </span>
      );

    case 'ink-static':
      return (
        <div className="ink-static" style={{ position: 'relative' }}>
          {renderedChildren}
        </div>
      );

    case 'ink-newline':
      return <br />;

    case 'ink-spacer':
      return <div className="ink-spacer" style={{ flex: 1 }} />;

    case 'ink-transform':
      return <span className="ink-transform">{renderedChildren}</span>;

    default:
      // For unknown components, render as a div
      console.warn(`Unknown component type: ${type}`);
      return (
        <div className={`unknown-${type}`} data-type={type}>
          {renderedChildren}
        </div>
      );
  }
}

/**
 * Main TreeRenderer component
 */
export function TreeRenderer({ tree }: TreeRendererProps): React.ReactElement {
  if (!tree) {
    return (
      <div className="tree-renderer-empty">
        <p>Waiting for render data...</p>
      </div>
    );
  }

  return (
    <div className="tree-renderer">
      <RenderNode node={tree} />
    </div>
  );
}

export default TreeRenderer;
