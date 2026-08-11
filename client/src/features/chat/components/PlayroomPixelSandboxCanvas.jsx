/**
 * PlayroomPixelSandboxCanvas.jsx
 * HTML5 Canvas 2D Retro Office sandbox viewport with simulation badges and velocity controllers.
 */

import React from 'react';
import { Space, Typography, Tooltip, Button } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, ForwardOutlined } from '@ant-design/icons';

const { Text } = Typography;

export function PlayroomPixelSandboxCanvas({
  canvasRef,
  isPlaying,
  isRunningSOP,
  pauseSOP,
  resumeSOP,
  stepForward,
  speed,
  setSpeed,
}) {
  return (
    <div className="pixel-board-container">
      {/* HTML5 Canvas retro grid viewport */}
      <div className="canvas-frame">
        <canvas ref={canvasRef} width={640} height={480} style={{ imageRendering: 'pixelated' }} />
      </div>

      {/* Playback Control Bar */}
      <div className="playback-controls" style={{ padding: '8px 16px', background: '#fcfcfb', borderTop: '1px solid #edece9' }}>
        <Space size="large" style={{ width: '100%', justifyContent: 'space-between', display: 'flex' }}>
          <div className="simulation-badge" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className={`sim-dot ${isPlaying ? 'dot-active' : ''}`}></span>
            <Text style={{ color: '#37352f', fontSize: 12, fontWeight: 600 }}>
              {isRunningSOP ? (isPlaying ? '仿真协作中' : '仿真已暂停') : '沙盘静置中'}
            </Text>
          </div>

          <Space size={12}>
            {isRunningSOP && (
              <Space>
                {isPlaying ? (
                  <Button
                    type="text"
                    icon={<PauseCircleOutlined style={{ color: '#37352f', fontSize: 16 }} />}
                    onClick={pauseSOP}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  />
                ) : (
                  <Button
                    type="text"
                    icon={<PlayCircleOutlined style={{ color: '#37352f', fontSize: 16 }} />}
                    onClick={resumeSOP}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  />
                )}
                <Tooltip title="手动单步调试">
                  <Button
                    type="text"
                    icon={<ForwardOutlined style={{ color: '#37352f', fontSize: 16 }} />}
                    onClick={stepForward}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  />
                </Tooltip>
              </Space>
            )}
          </Space>

          <div className="speed-buttons" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Text style={{ color: '#888', marginRight: 4, fontSize: 11 }}>速率:</Text>
            <Button
              type={speed === 1 ? 'primary' : 'default'}
              size="small"
              onClick={() => setSpeed(1)}
              style={{ fontSize: '10px', height: '20px', padding: '0 6px', display: 'flex', alignItems: 'center' }}
            >
              1x
            </Button>
            <Button
              type={speed === 2 ? 'primary' : 'default'}
              size="small"
              onClick={() => setSpeed(2)}
              style={{ fontSize: '10px', height: '20px', padding: '0 6px', display: 'flex', alignItems: 'center' }}
            >
              2x
            </Button>
            <Button
              type={speed === 4 ? 'primary' : 'default'}
              size="small"
              onClick={() => setSpeed(4)}
              style={{ fontSize: '10px', height: '20px', padding: '0 6px', display: 'flex', alignItems: 'center' }}
            >
              4x
            </Button>
          </div>
        </Space>
      </div>
    </div>
  );
}
