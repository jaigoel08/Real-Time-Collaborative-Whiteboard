import React, { useRef, useEffect, useState } from 'react';
import Konva from 'konva';
import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';
const API_URL = 'http://localhost:3000/api/boards';

const TOOLS = {
  SELECT: 'select',
  PEN: 'pen',
  ERASER: 'eraser',
  RECT: 'rect',
  CIRCLE: 'circle',
  ARROW: 'arrow',
  STAR: 'star',
  POLYGON: 'polygon',
  ELLIPSE: 'ellipse',
  TEXT: 'text',
  IMAGE: 'image',
};

const FILTERS = {
  NONE: 'none',
  BLUR: 'blur',
  GRAYSCALE: 'grayscale',
  INVERT: 'invert',
};

const uuid = () => '_' + Math.random().toString(36).substr(2, 9);

const applyFilter = (shape, filterType) => {
  shape.filters([]);
  if (filterType === FILTERS.BLUR) {
    shape.filters([Konva.Filters.Blur]);
    shape.blurRadius(10);
  } else if (filterType === FILTERS.GRAYSCALE) {
    shape.filters([Konva.Filters.Grayscale]);
  } else if (filterType === FILTERS.INVERT) {
    shape.filters([Konva.Filters.Invert]);
  }
  shape.getLayer()?.batchDraw();
};

const shapeFromData = (data, onTextEdit = null, onDragEnd = null, onTransformEnd = null) => {
  let shape;
  const base = { ...data, draggable: true };
  switch (data.type) {
    case 'rect':
      shape = new Konva.Rect(base);
      break;
    case 'circle':
      shape = new Konva.Circle(base);
      break;
    case 'arrow':
      shape = new Konva.Arrow(base);
      break;
    case 'star':
      shape = new Konva.Star(base);
      break;
    case 'polygon':
      shape = new Konva.RegularPolygon(base);
      break;
    case 'ellipse':
      shape = new Konva.Ellipse(base);
      break;
    case 'pen':
      shape = new Konva.Line({ ...base, draggable: false });
      break;
    case 'eraser':
      shape = new Konva.Line({
        ...base,
        stroke: '#fff',
        globalCompositeOperation: 'destination-out',
        draggable: false,
      });
      break;
    case 'text':
      shape = new Konva.Text(base);
      if (onTextEdit) {
        shape.on('dblclick dbltap', () => onTextEdit(data));
      }
      break;
    case 'image':
      const img = new window.Image();
      img.src = base.imageUrl;
      shape = new Konva.Image({ ...base, image: img });
      break;
    default:
      break;
  }
  if (shape && base.filter) applyFilter(shape, base.filter);

  // Real-time sync for move and resize
  if (shape && base.draggable && typeof base.id === 'string') {
    if (onDragEnd) {
      shape.on('dragend', (e) => {
        onDragEnd(base.id, e.target.x(), e.target.y());
      });
    }
    if (onTransformEnd) {
      shape.on('transformend', (e) => {
        const node = e.target;
        let updated;
        if (base.type === 'rect' || base.type === 'image') {
          updated = {
            width: Math.max(5, node.width() * node.scaleX()),
            height: Math.max(5, node.height() * node.scaleY()),
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
          };
        } else if (base.type === 'circle') {
          updated = {
            radius: Math.max(5, node.radius() * node.scaleX()),
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
          };
        } else if (base.type === 'ellipse') {
          updated = {
            radiusX: Math.max(5, node.radiusX() * node.scaleX()),
            radiusY: Math.max(5, node.radiusY() * node.scaleY()),
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
          };
        } else {
          updated = {
            x: node.x(),
            y: node.y(),
            rotation: node.rotation(),
          };
        }
        node.scaleX(1);
        node.scaleY(1);
        onTransformEnd(base.id, updated);
      });
    }
  }
  return shape;
};

const Whiteboard = ({ boardId = "default", jwt }) => {
  const containerRef = useRef();
  const stageRef = useRef();
  const layerRef = useRef();
  const transformerRef = useRef();
  const socketRef = useRef();

  const [tool, setTool] = useState(TOOLS.PEN);
  const [color, setColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [filter, setFilter] = useState(FILTERS.NONE);
  const [imageUrl, setImageUrl] = useState('');
  const [drawingText, setDrawingText] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [textInputValue, setTextInputValue] = useState('');

  const [boardData, setBoardData] = useState([]);
  const [selectedShapeId, setSelectedShapeId] = useState(null);

  const isDrawing = useRef(false);
  const tempShape = useRef(null);
  const lastLine = useRef(null);
  const startPos = useRef(null);

  const fileInputRef = useRef();
  const saveTimeoutRef = useRef(null);
  const textInputRef = useRef(null);

  // --- SOCKET.IO SETUP
  useEffect(() => {
    socketRef.current = io(SOCKET_URL);
    socketRef.current.emit('join-board', boardId);

    // SHAPES AND TEXTS SYNC
    socketRef.current.on('drawing', ({ data }) => {
      setBoardData(prev => {
        const idx = prev.findIndex(x => x.id === data.id);
        if (idx > -1) {
          const arr = [...prev];
          arr[idx] = { ...arr[idx], ...data };
          return arr;
        }
        return [...prev, data];
      });
    });

    // SHAPE REMOVAL SYNC
    socketRef.current.on('shape-removed', ({ shapeId }) => {
      setBoardData(prev => {
        const arr = prev.filter(shape => shape.id !== shapeId);
        return arr;
      });
      // If the removed shape was selected, deselect it
      if (selectedShapeId === shapeId) {
        setSelectedShapeId(null);
        if (transformerRef.current) {
          try {
            transformerRef.current.nodes([]);
            transformerRef.current.visible(false);
            layerRef.current.batchDraw();
          } catch (error) {
            console.warn('Error hiding transformer after remote removal:', error);
          }
        }
      }
    });

    // CLEAR EVENT SYNC
    socketRef.current.on('clear-board', (clearedId) => {
      console.log('Received clear-board event:', clearedId, 'Current boardId:', boardId);
      if (clearedId === boardId) {
        console.log('Clearing board data for board:', boardId);
        setBoardData([]);
        setSelectedShapeId(null);
        // Also clear the layer
        if (layerRef.current) {
          layerRef.current.destroyChildren();
          layerRef.current.batchDraw();
        }
      }
    });

    return () => socketRef.current.disconnect();
  }, [boardId]);

  // --- INIT KONVA
  useEffect(() => {
    if (!containerRef.current) return;
    
    try {
      const stage = new Konva.Stage({
        container: containerRef.current,
        width: 1000,
        height: 600,
      });
      const layer = new Konva.Layer();
      stage.add(layer);

      const transformer = new Konva.Transformer({
        rotateEnabled: true,
        enabledAnchors: [
          'top-left',
          'top-right',
          'bottom-left',
          'bottom-right',
        ],
        keepRatio: false,
        visible: false,
      });
      layer.add(transformer);

      stageRef.current = stage;
      layerRef.current = layer;
      transformerRef.current = transformer;
    } catch (error) {
      console.error('Error initializing Konva stage:', error);
    }

    return () => {
      try {
        if (transformerRef.current) {
          transformerRef.current.nodes([]);
          transformerRef.current.destroy();
        }
        if (stageRef.current) {
          stageRef.current.destroy();
        }
      } catch (error) {
        console.warn('Error cleaning up Konva stage:', error);
      }
    };
  }, []);

  // --- FETCH BOARD DATA
  useEffect(() => {
    fetch(`${API_URL}/${boardId}/data`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBoardData(data);
        } else if (data && typeof data === 'object') {
          setBoardData(Array.isArray(data.data) ? data.data : []);
        } else {
          setBoardData([]);
        }
      })
      .catch(() => setBoardData([]));
  }, [boardId]);

  // --- DRAGEND SYNC HANDLER
  const handleDragEnd = (id, x, y) => {
    setBoardData(prev => {
      const idx = prev.findIndex(shape => shape.id === id);
      if (idx === -1) return prev;
      const arr = [...prev];
      arr[idx] = { ...arr[idx], x, y };
      if (socketRef.current)
        socketRef.current.emit('drawing', { boardId, data: arr[idx] });
      debouncedSaveBoardData(arr);
      return arr;
    });
  };

  // --- TRANSFORMEND SYNC HANDLER (resize/rotate)
  const handleTransformEnd = (id, updated) => {
    setBoardData(prev => {
      const idx = prev.findIndex(shape => shape.id === id);
      if (idx === -1) return prev;
      const arr = [...prev];
      arr[idx] = { ...arr[idx], ...updated };
      if (socketRef.current)
        socketRef.current.emit('drawing', { boardId, data: arr[idx] });
      debouncedSaveBoardData(arr);
      return arr;
    });
  };

  // --- REMOVE SELECTED SHAPE
  const removeSelectedShape = () => {
    if (!selectedShapeId) return;
    
    setBoardData(prev => {
      const arr = prev.filter(shape => shape.id !== selectedShapeId);
      debouncedSaveBoardData(arr);
      if (socketRef.current) {
        socketRef.current.emit('shape-removed', { boardId, shapeId: selectedShapeId });
      }
      return arr;
    });
    setSelectedShapeId(null);
    
    // Hide transformer
    if (transformerRef.current) {
      try {
        transformerRef.current.nodes([]);
        transformerRef.current.visible(false);
        layerRef.current.batchDraw();
      } catch (error) {
        console.warn('Error hiding transformer after removal:', error);
      }
    }
  };

  // --- Add text shape on click with text tool
  useEffect(() => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    const handler = (e) => {
      if (tool === TOOLS.TEXT) {
        const pos = stage.getPointerPosition();
        const newTextShape = {
          id: uuid(),
          type: 'text',
          x: pos.x,
          y: pos.y,
          text: 'Double-click to edit',
          fontSize: 24,
          fill: color,
          opacity,
          filter,
          draggable: true,
        };
        setBoardData(prev => [...prev, newTextShape]);
        if (socketRef.current) socketRef.current.emit('drawing', { boardId, data: newTextShape });
        debouncedSaveBoardData([...(Array.isArray(boardData) ? boardData : []), newTextShape]);
      }
    };
    stage.on('mousedown', handler);
    return () => stage.off('mousedown', handler);
  }, [tool, color, opacity, filter, boardData]);

  // --- DESELECT ON EMPTY CLICK
  useEffect(() => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    
    const handleStageClick = (e) => {
      // If clicked on stage but not on a shape, deselect
      if (e.target === stage || e.target === layerRef.current) {
        setSelectedShapeId(null);
        if (transformerRef.current) {
          try {
            transformerRef.current.nodes([]);
            transformerRef.current.visible(false);
            layerRef.current.batchDraw();
          } catch (error) {
            console.warn('Error hiding transformer:', error);
          }
        }
      }
    };
    
    stage.on('click', handleStageClick);
    return () => stage.off('click', handleStageClick);
  }, []);

  // --- RENDER SHAPES
  useEffect(() => {
    if (!layerRef.current) return;
    
    // Clear transformer before destroying children
    if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.visible(false);
    }
    
    layerRef.current.destroyChildren();

    boardData.forEach((data, i) => {
      const shape = shapeFromData(
        data,
        handleTextEdit,
        handleDragEnd,
        handleTransformEnd
      );
      if (!shape) return;

      // Selection
      shape.on('click tap', () => {
        setSelectedShapeId(data.id);
        if (transformerRef.current && shape && typeof shape.isDestroyed === 'function' && !shape.isDestroyed()) {
          try {
            transformerRef.current.nodes([shape]);
            transformerRef.current.visible(true);
            layerRef.current.batchDraw();
          } catch (error) {
            console.warn('Error attaching transformer:', error);
            transformerRef.current.visible(false);
          }
        }
      });

      if (data.type === 'text') {
        shape.on('dblclick dbltap', () => handleTextEdit(data, i));
        // Also allow single click to edit text
        shape.on('click tap', () => {
          if (tool === TOOLS.SELECT) {
            handleTextEdit(data, i);
          }
        });
      }

      // If selected, attach transformer
      if (selectedShapeId === data.id) {
        setTimeout(() => {
          if (
            transformerRef.current &&
            shape &&
            typeof shape.isDestroyed === 'function' &&
            !shape.isDestroyed()
          ) {
            try {
              transformerRef.current.nodes([shape]);
              transformerRef.current.visible(true);
              layerRef.current.batchDraw();
            } catch (error) {
              console.warn('Error attaching transformer to selected shape:', error);
              transformerRef.current.visible(false);
            }
          }
        }, 0);
      }

      layerRef.current.add(shape);
    });

    // Show/hide transformer
    if (selectedShapeId) {
      const shape = layerRef.current.findOne(
        node => node.attrs.id === selectedShapeId
      );
      if (shape && transformerRef.current) {
        try {
          transformerRef.current.nodes([shape]);
          transformerRef.current.visible(true);
        } catch (error) {
          console.warn('Error showing transformer:', error);
          transformerRef.current.visible(false);
        }
      } else if (transformerRef.current) {
        transformerRef.current.visible(false);
      }
    } else if (transformerRef.current) {
      transformerRef.current.visible(false);
    }
    
    if (transformerRef.current) {
      layerRef.current.add(transformerRef.current);
    }
    layerRef.current.batchDraw();
  }, [boardData, selectedShapeId]);

  // --- CLEANUP TRANSFORMER ON UNMOUNT
  useEffect(() => {
    return () => {
      if (transformerRef.current) {
        try {
          transformerRef.current.nodes([]);
          transformerRef.current.destroy();
        } catch (error) {
          console.warn('Error cleaning up transformer:', error);
        }
      }
    };
  }, []);

  // --- DRAWING EVENTS (for all tools except text)
  useEffect(() => {
    if (!stageRef.current) return;
    const stage = stageRef.current;
    const layer = layerRef.current;

    function handleDown(e) {
      if (tool === TOOLS.TEXT) return; // handled in separate effect above
      if (e.target === transformerRef.current) return;
      isDrawing.current = true;
      const pos = stage.getPointerPosition();
      startPos.current = pos;

      if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
        lastLine.current = new Konva.Line({
          id: uuid(),
          stroke: tool === TOOLS.PEN ? color : '#fff',
          strokeWidth,
          opacity,
          points: [pos.x, pos.y],
          lineCap: 'round',
          tension: 0.5,
          draggable: false,
          globalCompositeOperation:
            tool === TOOLS.ERASER ? 'destination-out' : 'source-over',
        });
        layer.add(lastLine.current);
      } else if (tool === TOOLS.RECT) {
        tempShape.current = new Konva.Rect({
          id: uuid(),
          x: pos.x,
          y: pos.y,
          width: 0,
          height: 0,
          stroke: color,
          fill: fillColor,
          strokeWidth,
          opacity,
          draggable: true,
        });
        layer.add(tempShape.current);
      } else if (tool === TOOLS.CIRCLE) {
        tempShape.current = new Konva.Circle({
          id: uuid(),
          x: pos.x,
          y: pos.y,
          radius: 0,
          stroke: color,
          fill: fillColor,
          strokeWidth,
          opacity,
          draggable: true,
        });
        layer.add(tempShape.current);
      } else if (tool === TOOLS.ELLIPSE) {
        tempShape.current = new Konva.Ellipse({
          id: uuid(),
          x: pos.x,
          y: pos.y,
          radiusX: 0,
          radiusY: 0,
          stroke: color,
          fill: fillColor,
          strokeWidth,
          opacity,
          draggable: true,
        });
        layer.add(tempShape.current);
      } else if (tool === TOOLS.ARROW) {
        tempShape.current = new Konva.Arrow({
          id: uuid(),
          points: [pos.x, pos.y, pos.x, pos.y],
          stroke: color,
          strokeWidth,
          pointerLength: 10,
          pointerWidth: 10,
          opacity,
          draggable: true,
          fill: color,
        });
        layer.add(tempShape.current);
      } else if (tool === TOOLS.STAR) {
        tempShape.current = new Konva.Star({
          id: uuid(),
          x: pos.x,
          y: pos.y,
          numPoints: 5,
          innerRadius: 0,
          outerRadius: 0,
          stroke: color,
          fill: fillColor,
          strokeWidth,
          opacity,
          draggable: true,
        });
        layer.add(tempShape.current);
      } else if (tool === TOOLS.POLYGON) {
        tempShape.current = new Konva.RegularPolygon({
          id: uuid(),
          x: pos.x,
          y: pos.y,
          sides: 6,
          radius: 0,
          stroke: color,
          fill: fillColor,
          strokeWidth,
          opacity,
          draggable: true,
        });
        layer.add(tempShape.current);
      } else if (tool === TOOLS.IMAGE && imageUrl) {
        const id = uuid();
        const img = new window.Image();
        img.onload = () => {
          const shape = new Konva.Image({
            id,
            x: pos.x,
            y: pos.y,
            image: img,
            width: 120,
            height: 120,
            opacity,
            draggable: true,
          });
          if (filter !== FILTERS.NONE) applyFilter(shape, filter);
          layer.add(shape);
          const shapeData = {
            id,
            type: 'image',
            x: pos.x,
            y: pos.y,
            imageUrl,
            width: 120,
            height: 120,
            opacity,
            filter,
          };
          setBoardData(prev => [...(Array.isArray(prev) ? prev : []), shapeData]);
          if (socketRef.current)
            socketRef.current.emit('drawing', { boardId, data: shapeData });
          debouncedSaveBoardData([...boardData, shapeData]);
        };
        img.src = imageUrl;
        setTool(TOOLS.SELECT);
        setImageUrl('');
      }
    }
    function handleMove() {
      if (!isDrawing.current) return;
      const pos = stage.getPointerPosition();

      if (tool === TOOLS.PEN && lastLine.current) {
        const oldPoints = lastLine.current.points();
        lastLine.current.points([...oldPoints, pos.x, pos.y]);
        layer.batchDraw();
      } else if (tool === TOOLS.ERASER && lastLine.current) {
        const oldPoints = lastLine.current.points();
        lastLine.current.points([...oldPoints, pos.x, pos.y]);
        layer.batchDraw();
      } else if (tool === TOOLS.RECT && tempShape.current && startPos.current) {
        tempShape.current.width(pos.x - startPos.current.x);
        tempShape.current.height(pos.y - startPos.current.y);
        layer.batchDraw();
      } else if (tool === TOOLS.CIRCLE && tempShape.current && startPos.current) {
        const r = Math.sqrt(
          Math.pow(pos.x - startPos.current.x, 2) +
            Math.pow(pos.y - startPos.current.y, 2)
        );
        tempShape.current.radius(r);
        layer.batchDraw();
      } else if (tool === TOOLS.ELLIPSE && tempShape.current && startPos.current) {
        tempShape.current.radiusX(Math.abs(pos.x - startPos.current.x));
        tempShape.current.radiusY(Math.abs(pos.y - startPos.current.y));
        layer.batchDraw();
      } else if (tool === TOOLS.ARROW && tempShape.current && startPos.current) {
        tempShape.current.points([
          startPos.current.x,
          startPos.current.y,
          pos.x,
          pos.y,
        ]);
        layer.batchDraw();
      } else if (tool === TOOLS.STAR && tempShape.current && startPos.current) {
        const outR = Math.sqrt(
          Math.pow(pos.x - startPos.current.x, 2) +
            Math.pow(pos.y - startPos.current.y, 2)
        );
        tempShape.current.outerRadius(outR);
        tempShape.current.innerRadius(outR / 2.5);
        layer.batchDraw();
      } else if (
        tool === TOOLS.POLYGON &&
        tempShape.current &&
        startPos.current
      ) {
        const r = Math.sqrt(
          Math.pow(pos.x - startPos.current.x, 2) +
            Math.pow(pos.y - startPos.current.y, 2)
        );
        tempShape.current.radius(r);
        layer.batchDraw();
      }
    }
    function handleUp() {
      isDrawing.current = false;
      let shapeData = null;
      let id = uuid();

      if (tool === TOOLS.PEN && lastLine.current) {
        id = lastLine.current.attrs.id || id;
        shapeData = {
          id,
          type: 'pen',
          points: lastLine.current.points(),
          stroke: color,
          strokeWidth,
          opacity,
          filter,
        };
      } else if (tool === TOOLS.ERASER && lastLine.current) {
        id = lastLine.current.attrs.id || id;
        shapeData = {
          id,
          type: 'eraser',
          points: lastLine.current.points(),
          stroke: '#fff',
          strokeWidth,
          opacity,
        };
      } else if (tool === TOOLS.RECT && tempShape.current) {
        id = tempShape.current.attrs.id || id;
        shapeData = {
          id,
          type: 'rect',
          x: tempShape.current.x(),
          y: tempShape.current.y(),
          width: tempShape.current.width(),
          height: tempShape.current.height(),
          stroke: color,
          fill: fillColor,
          strokeWidth,
          opacity,
          filter,
        };
      } else if (tool === TOOLS.CIRCLE && tempShape.current) {
        id = tempShape.current.attrs.id || id;
        shapeData = {
          id,
          type: 'circle',
          x: tempShape.current.x(),
          y: tempShape.current.y(),
          radius: tempShape.current.radius(),
          stroke: color,
          fill: fillColor,
          strokeWidth,
          opacity,
          filter,
        };
      } else if (tool === TOOLS.ELLIPSE && tempShape.current) {
        id = tempShape.current.attrs.id || id;
        shapeData = {
          id,
          type: 'ellipse',
          x: tempShape.current.x(),
          y: tempShape.current.y(),
          radiusX: tempShape.current.radiusX(),
          radiusY: tempShape.current.radiusY(),
          stroke: color,
          fill: fillColor,
          strokeWidth,
          opacity,
          filter,
        };
      } else if (tool === TOOLS.ARROW && tempShape.current) {
        id = tempShape.current.attrs.id || id;
        shapeData = {
          id,
          type: 'arrow',
          points: tempShape.current.points(),
          stroke: color,
          fill: color,
          strokeWidth,
          opacity,
          filter,
        };
      } else if (tool === TOOLS.STAR && tempShape.current) {
        id = tempShape.current.attrs.id || id;
        shapeData = {
          id,
          type: 'star',
          x: tempShape.current.x(),
          y: tempShape.current.y(),
          numPoints: 5,
          innerRadius: tempShape.current.innerRadius(),
          outerRadius: tempShape.current.outerRadius(),
          stroke: color,
          fill: fillColor,
          strokeWidth,
          opacity,
          filter,
        };
      } else if (tool === TOOLS.POLYGON && tempShape.current) {
        id = tempShape.current.attrs.id || id;
        shapeData = {
          id,
          type: 'polygon',
          x: tempShape.current.x(),
          y: tempShape.current.y(),
          sides: 6,
          radius: tempShape.current.radius(),
          stroke: color,
          fill: fillColor,
          strokeWidth,
          opacity,
          filter,
        };
      }
      if (shapeData) {
        setBoardData(prev => [...(Array.isArray(prev) ? prev : []), shapeData]);
        if (socketRef.current)
          socketRef.current.emit('drawing', { boardId, data: shapeData });
        debouncedSaveBoardData([...(Array.isArray(boardData) ? boardData : []), shapeData]);
      }
      tempShape.current = null;
      lastLine.current = null;
    }

    stage.on('mousedown touchstart', handleDown);
    stage.on('mousemove touchmove', handleMove);
    stage.on('mouseup touchend', handleUp);

    return () => {
      stage.off('mousedown touchstart', handleDown);
      stage.off('mousemove touchmove', handleMove);
      stage.off('mouseup touchend', handleUp);
    };
  }, [tool, color, fillColor, strokeWidth, opacity, filter, imageUrl, boardData.length]);

  // --- DEBOUNCED SAVE FUNCTION
  function debouncedSaveBoardData(newData) {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveBoardData(newData);
    }, 1000); // Save after 1 second of inactivity
  }

  // --- SAVE BOARD DATA TO SERVER
  function saveBoardData(newData) {
    const headers = { 'Content-Type': 'application/json' };
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
    
    // Check payload size before sending
    const payload = JSON.stringify({ data: newData });
    const payloadSize = new Blob([payload]).size;
    
    console.log(`Saving board data: ${payloadSize} bytes, ${newData.length} shapes`);
    
    // If payload is too large, try to compress or batch
    if (payloadSize > 10 * 1024 * 1024) { // 10MB warning
      console.warn('Large payload detected, consider clearing some shapes');
    }
    
    fetch(`${API_URL}/${boardId}`, {
      method: 'POST',
      headers,
      body: payload,
    })
    .then(response => {
      if (!response.ok) {
        if (response.status === 413) {
          console.error('Payload too large. Consider clearing the board or reducing shapes.');
          alert('Board data is too large. Please clear some shapes and try again.');
        } else {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }
      return response.json();
    })
    .then(data => {
      console.log('Board data saved successfully');
    })
    .catch(error => {
      console.error('Error saving board data:', error);
    });
  }

  // --- TEXT HANDLING (double click to edit)
  function handleTextEdit(data, index) {
    setEditingText(data);
    setTextInputValue(data.text || '');
    // Focus the text input after a short delay to ensure it's rendered
    setTimeout(() => {
      if (textInputRef.current) {
        textInputRef.current.focus();
        textInputRef.current.select();
      }
    }, 100);
  }

  // --- SAVE TEXT EDIT
  const saveTextEdit = () => {
    if (!editingText) return;
    
    const newShape = {
      ...editingText,
      text: textInputValue,
      draggable: true,
    };
    
    setBoardData(prev => {
      const arr = [...prev];
      const idx = arr.findIndex(x => x.id === editingText.id);
      if (idx > -1) {
        arr[idx] = newShape;
      } else {
        arr.push(newShape);
      }
      if (socketRef.current)
        socketRef.current.emit('drawing', { boardId, data: newShape });
      debouncedSaveBoardData(arr);
      return arr;
    });
    
    setEditingText(null);
    setTextInputValue('');
  };

  // --- CANCEL TEXT EDIT
  const cancelTextEdit = () => {
    setEditingText(null);
    setTextInputValue('');
  };

  // --- HANDLE TEXT INPUT KEY EVENTS
  const handleTextInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveTextEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelTextEdit();
    }
  };

  // --- CLOSE TEXT EDITOR ON OUTSIDE CLICK
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (editingText && textInputRef.current && !textInputRef.current.contains(e.target)) {
        // Check if click is outside the text editor
        const textEditor = e.target.closest('[data-text-editor]');
        if (!textEditor) {
          saveTextEdit();
        }
      }
    };

    if (editingText) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingText]);

  // --- DELETE KEY
  useEffect(() => {
    const handler = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId && boardData.length) {
        e.preventDefault(); // Prevent default browser behavior
        removeSelectedShape();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedShapeId, boardData]);

  // --- IMAGE PICK FROM GALLERY HANDLER
  const handleFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result);
    reader.readAsDataURL(file);
    setTool(TOOLS.IMAGE);
    e.target.value = '';
  };

  // --- DOWNLOAD AS IMAGE ---
  const handleDownload = () => {
    if (!stageRef.current) return;
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = 'whiteboard.png';
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- UI ---
  return (
    <div style={{ 
      userSelect: "none", 
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      backgroundColor: '#f8fafc',
      minHeight: '100vh'
    }}>
      {/* Text Editing Input Box */}
      {editingText && (
        <div 
          data-text-editor
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            backgroundColor: 'white',
            border: '2px solid #3b82f6',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
            minWidth: '350px',
            maxWidth: '90vw'
          }}
        >
          <div style={{ 
            marginBottom: '12px', 
            fontWeight: '600', 
            color: '#3b82f6',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>✏️</span>
            Edit Text
          </div>
          <textarea
            ref={textInputRef}
            value={textInputValue}
            onChange={(e) => setTextInputValue(e.target.value)}
            onKeyDown={handleTextInputKeyDown}
            onBlur={saveTextEdit}
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '12px',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            placeholder="Enter your text here..."
          />
          <div style={{ 
            marginTop: '12px', 
            display: 'flex', 
            gap: '8px', 
            justifyContent: 'flex-end' 
          }}>
            <button
              onClick={cancelTextEdit}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#4b5563'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#6b7280'}
            >
              Cancel
            </button>
            <button
              onClick={saveTextEdit}
              style={{
                padding: '8px 16px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Main Toolbar */}
      <div style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: 'clamp(12px, 3vw, 16px) clamp(15px, 4vw, 20px)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflowX: 'auto'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(12px, 3vw, 16px)'
        }}>
          {/* Top Row - Main Tools */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'clamp(8px, 2vw, 12px)',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            {/* Left Side - Tools */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'clamp(6px, 1.5vw, 8px)',
              alignItems: 'center',
              flex: '1',
              minWidth: '0'
            }}>
              {/* Tool Selector */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(6px, 1.5vw, 8px)',
                backgroundColor: '#f8fafc',
                padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                minWidth: 'fit-content'
              }}>
                <span style={{ fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: '500', color: '#374151' }}>🛠️</span>
                <select 
                  value={tool} 
                  onChange={e => setTool(e.target.value)}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    fontSize: 'clamp(12px, 3vw, 14px)',
                    fontWeight: '500',
                    color: '#374151',
                    cursor: 'pointer',
                    outline: 'none',
                    minWidth: '80px'
                  }}
                >
                  {Object.entries(TOOLS).map(([k, v]) => (
                    <option value={v} key={k}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Color Controls */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(6px, 1.5vw, 8px)',
                backgroundColor: '#f8fafc',
                padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                minWidth: 'fit-content'
              }}>
                <span style={{ fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: '500', color: '#374151' }}>🎨</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'clamp(10px, 2.5vw, 12px)', color: '#6b7280' }}>
                  <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Stroke</span>
                  <input 
                    type="color" 
                    value={color} 
                    onChange={e => setColor(e.target.value)}
                    style={{
                      width: 'clamp(20px, 5vw, 24px)',
                      height: 'clamp(20px, 5vw, 24px)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'clamp(10px, 2.5vw, 12px)', color: '#6b7280' }}>
                  <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Fill</span>
                  <input 
                    type="color" 
                    value={fillColor} 
                    onChange={e => setFillColor(e.target.value)}
                    style={{
                      width: 'clamp(20px, 5vw, 24px)',
                      height: 'clamp(20px, 5vw, 24px)',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  />
                </label>
              </div>

              {/* Stroke Width */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(6px, 1.5vw, 8px)',
                backgroundColor: '#f8fafc',
                padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                minWidth: 'fit-content'
              }}>
                <span style={{ fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: '500', color: '#374151' }}>📏</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'clamp(10px, 2.5vw, 12px)', color: '#6b7280' }}>
                  <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Width</span>
                  <input 
                    type="range" 
                    min="1" 
                    max="20" 
                    value={strokeWidth} 
                    onChange={e => setStrokeWidth(Number(e.target.value))}
                    style={{ width: 'clamp(40px, 10vw, 60px)' }}
                  />
                  <span style={{ fontSize: 'clamp(9px, 2vw, 11px)', minWidth: '20px' }}>{strokeWidth}</span>
                </label>
              </div>

              {/* Opacity */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(6px, 1.5vw, 8px)',
                backgroundColor: '#f8fafc',
                padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                minWidth: 'fit-content'
              }}>
                <span style={{ fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: '500', color: '#374151' }}>👁️</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'clamp(10px, 2.5vw, 12px)', color: '#6b7280' }}>
                  <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Opacity</span>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="1" 
                    step="0.1" 
                    value={opacity} 
                    onChange={e => setOpacity(Number(e.target.value))}
                    style={{ width: 'clamp(40px, 10vw, 60px)' }}
                  />
                  <span style={{ fontSize: 'clamp(9px, 2vw, 11px)', minWidth: '20px' }}>{Math.round(opacity * 100)}%</span>
                </label>
              </div>

              {/* Filters */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'clamp(6px, 1.5vw, 8px)',
                backgroundColor: '#f8fafc',
                padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                minWidth: 'fit-content'
              }}>
                <span style={{ fontSize: 'clamp(12px, 3vw, 14px)', fontWeight: '500', color: '#374151' }}>✨</span>
                <select 
                  value={filter} 
                  onChange={e => setFilter(e.target.value)}
                  style={{
                    border: 'none',
                    backgroundColor: 'transparent',
                    fontSize: 'clamp(10px, 2.5vw, 12px)',
                    color: '#374151',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  {Object.entries(FILTERS).map(([k, v]) => (
                    <option value={v} key={k}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Side - Actions */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'clamp(6px, 1.5vw, 8px)',
              alignItems: 'center',
              flexShrink: '0'
            }}>
              {/* Upload Image */}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                style={{
                  padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: 'clamp(10px, 2.5vw, 12px)',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background-color 0.2s',
                  minHeight: 'clamp(32px, 8vw, 40px)',
                  minWidth: 'clamp(44px, 10vw, 60px)'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#059669'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#10b981'}
              >
                📁 <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Upload</span>
              </button>

              {/* Image URL Input */}
              {tool === TOOLS.IMAGE && (
                <input
                  type="text"
                  placeholder="Paste Image URL"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  style={{
                    padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: 'clamp(10px, 2.5vw, 12px)',
                    width: 'clamp(120px, 25vw, 180px)',
                    outline: 'none',
                    minHeight: 'clamp(32px, 8vw, 40px)'
                  }}
                />
              )}

              {/* Delete Selected */}
              <button 
                onClick={removeSelectedShape} 
                disabled={!selectedShapeId}
                style={{ 
                  padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)', 
                  backgroundColor: selectedShapeId ? '#ef4444' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: selectedShapeId ? 'pointer' : 'not-allowed',
                  fontSize: 'clamp(10px, 2.5vw, 12px)',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background-color 0.2s',
                  minHeight: 'clamp(32px, 8vw, 40px)',
                  minWidth: 'clamp(44px, 10vw, 60px)'
                }}
                onMouseOver={(e) => {
                  if (selectedShapeId) e.target.style.backgroundColor = '#dc2626';
                }}
                onMouseOut={(e) => {
                  if (selectedShapeId) e.target.style.backgroundColor = '#ef4444';
                }}
              >
                🗑️ <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Delete</span>
              </button>

              {/* Clear All */}
              <button 
                onClick={() => {
                  console.log('Clear All button clicked, emitting clear-board event for boardId:', boardId);
                  setBoardData([]);
                  setSelectedShapeId(null);
                  debouncedSaveBoardData([]);
                  if (socketRef.current) {
                    socketRef.current.emit('clear-board', boardId);
                  }
                }}
                style={{
                  padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: 'clamp(10px, 2.5vw, 12px)',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background-color 0.2s',
                  minHeight: 'clamp(32px, 8vw, 40px)',
                  minWidth: 'clamp(44px, 10vw, 60px)'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#d97706'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#f59e0b'}
              >
                🧹 <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Clear</span>
              </button>

              {/* Download */}
              <button 
                onClick={handleDownload}
                style={{
                  padding: 'clamp(6px, 1.5vw, 8px) clamp(8px, 2vw, 12px)',
                  backgroundColor: '#8b5cf6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: 'clamp(10px, 2.5vw, 12px)',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'background-color 0.2s',
                  minHeight: 'clamp(32px, 8vw, 40px)',
                  minWidth: 'clamp(44px, 10vw, 60px)'
                }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#7c3aed'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#8b5cf6'}
              >
                💾 <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Download</span>
              </button>
            </div>
          </div>

          {/* Bottom Row - Instructions */}
          <div style={{
            fontSize: 'clamp(10px, 2.5vw, 12px)',
            color: '#6b7280',
            textAlign: 'center',
            padding: 'clamp(6px, 1.5vw, 8px) 0',
            borderTop: '1px solid #f3f4f6'
          }}>
            💡 <strong>Tips:</strong> <span style={{ display: window.innerWidth < 480 ? 'none' : 'inline' }}>Click to add text • Double-click text to edit • Select + Delete to remove • </span>Real-time collaboration enabled
          </div>
        </div>
      </div>

      {/* Canvas Container */}
      <div style={{
        padding: 'clamp(10px, 3vw, 20px)',
        display: 'flex',
        justifyContent: 'center',
        minHeight: 'calc(100vh - clamp(120px, 25vw, 200px))'
      }}>
        <div
          ref={containerRef}
          style={{
            border: "2px solid #e2e8f0",
            borderRadius: "12px",
            background: "#fff",
            width: "100%",
            maxWidth: "clamp(300px, 90vw, 1200px)",
            height: "clamp(300px, 60vh, 600px)",
            boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
            overflow: "hidden"
          }}
        />
      </div>
    </div>
  );
};

export default Whiteboard;