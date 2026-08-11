/**
 * AgentPlayroom.jsx
 * The main gamified sandbox page workspace integrating the HTML5 Canvas pixel board,
 * Kanban task boards, printed artifacts cards, and BOSS text override interventions.
 * Fully modularized according to engineering best practices, dividing the interface into:
 * - PlayroomHeader: clean top bar control desk.
 * - PlayroomOnboardingEmptyView: elegant centered zero-project state.
 * - PlayroomWorkspaceSidebarLeft: left-wing milestones & Kanban tasks tabs card.
 * - PlayroomPixelSandboxCanvas: central tilemap & character animation sandbox viewport.
 * - PlayroomBossInterventionPanel: realtime CEO speech overrides input drawer.
 * - PlayroomConsoleSidebarRight: right-wing printed artifacts deck & meetings terminal logs.
 * - PlayroomCreateTeamModal: digital team recruits config modal.
 */

import React, { useEffect, useRef, useState } from 'react';
import { theme, message } from 'antd';
import { useAgentPlayroom } from '../context/AgentPlayroomContext';
import { drawMap, drawCharacter } from './PixelOfficeEngine';

// Import newly refactored prefix unified standalone subcomponents
import { PlayroomHeader } from './PlayroomHeader';
import { PlayroomOnboardingEmptyView } from './PlayroomOnboardingEmptyView';
import { PlayroomWorkspaceSidebarLeft } from './PlayroomWorkspaceSidebarLeft';
import { PlayroomPixelSandboxCanvas } from './PlayroomPixelSandboxCanvas';
import { PlayroomBossInterventionPanel } from './PlayroomBossInterventionPanel';
import { PlayroomConsoleSidebarRight } from './PlayroomConsoleSidebarRight';
import { PlayroomCreateTeamModal } from './PlayroomCreateTeamModal';

import { useAppResources } from '../../../pages/app-detail/context/AppResourcesContext';

import './AgentPlayroom.css';

export function AgentPlayroom() {
  const {
    agents,
    tasks,
    artifacts,
    chatHistory,
    isPlaying,
    speed,
    currentSOPMode,
    isRunningSOP,
    currentMilestone,
    waitingForBossApproval,
    startSOPTask,
    pauseSOP,
    resumeSOP,
    stepForward,
    setSpeed,
    approveMilestone,
    injectBossCommand,
    availableAgents,
    teamsList,
    isLoadingTeams,
    loadExistingTeam,
    removeTeam,
    teamName,
    ceoId,
    activeTeamId,
  } = useAgentPlayroom();

  const canvasRef = useRef(null);
  const chatEndRef = useRef(null);

  const { siderCollapsed, setSiderCollapsed } = useAppResources();

  // Component local states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [teamNameInput, setTeamNameInput] = useState('');
  const [selectedCeoId, setSelectedCeoId] = useState(undefined);
  const [selectedAgentIds, setSelectedAgentIds] = useState([]);
  const [bossInput, setBossInput] = useState('');
  const [renderFrame, setRenderFrame] = useState(0);

  // 1. Cascade auto-loading first available team to enforce pure onboarding-to-simulation stateflow
  useEffect(() => {
    if (!isRunningSOP && teamsList && teamsList.length > 0) {
      loadExistingTeam(teamsList[0], true);
    }
  }, [isRunningSOP, teamsList, loadExistingTeam]);

  // 2. Setup Canvas animation loop at 60 FPS
  useEffect(() => {
    let frameId;

    const drawLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw map boundaries and office tiles
      drawMap(ctx);

      // Render anim characters in simulated coordinates
      agents.forEach((agent) => {
        const isCeo = agent.id === ceoId || agent.role === 'CEO';
        drawCharacter(ctx, agent, renderFrame, isCeo);
      });

      frameId = requestAnimationFrame(drawLoop);
    };

    frameId = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(frameId);
  }, [agents, ceoId, renderFrame]);

  // 3. Sprite walking micro-animations tick
  useEffect(() => {
    const timer = setInterval(() => {
      setRenderFrame((prev) => (prev + 1) % 4);
    }, 150);
    return () => clearInterval(timer);
  }, []);

  // 4. Automatically scroll terminal chat panel to bottom when new logs stream in
  useEffect(() => {
    const timer = setTimeout(() => {
      if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [chatHistory]);

  // Handle selected state toggles during team configuration
  const handleToggleAgent = (id) => {
    if (id === selectedCeoId) {
      message.info('CEO 默认自动加入项目组，无需额外勾选 👑');
      return;
    }

    setSelectedAgentIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 7) {
        message.warning('🏢 智能体办公室工位有限，每个项目组最多招募 8 名数字员工一同协同。');
        return prev;
      }
      return [...prev, id];
    });
  };

  // Launch SOP task simulation and close dialog
  const handleStart = () => {
    if (!teamNameInput.trim()) {
      message.warning('请填写项目组名称！');
      return;
    }
    if (!selectedCeoId) {
      message.warning('请选择一位数字员工担任 CEO！');
      return;
    }

    const totalUniqueAgents = new Set([selectedCeoId, ...selectedAgentIds]);
    if (totalUniqueAgents.size > 8) {
      message.warning('🏢 协同项目组最多招募 8 名数字员工一同办公！');
      return;
    }

    startSOPTask(teamNameInput, selectedCeoId, selectedAgentIds);
    setIsCreateModalOpen(false);

    // Clean inputs
    setTeamNameInput('');
    setSelectedCeoId(undefined);
    setSelectedAgentIds([]);
  };

  // Inject command text into active chat
  const handleBossSend = () => {
    if (!bossInput.trim()) return;
    injectBossCommand(bossInput);
    setBossInput('');
  };

  // Prevent selecting same member both as CEO and normal recruit
  const handleCeoChange = (val) => {
    setSelectedCeoId(val);
    setSelectedAgentIds((prev) => prev.filter((id) => id !== val));
  };

  // Sub-method to keep dialog states clean
  const renderCreateTeamModal = () => {
    return (
      <PlayroomCreateTeamModal
        isOpen={isCreateModalOpen}
        onOk={handleStart}
        onCancel={() => setIsCreateModalOpen(false)}
        teamNameInput={teamNameInput}
        setTeamNameInput={setTeamNameInput}
        selectedCeoId={selectedCeoId}
        handleCeoChange={handleCeoChange}
        availableAgents={availableAgents}
        selectedAgentIds={selectedAgentIds}
        handleToggleAgent={handleToggleAgent}
      />
    );
  };

  // ==================== VIEW 2: ONBOARDING EMPTY STATE VIEW ====================
  if (!isRunningSOP) {
    return (
      <PlayroomOnboardingEmptyView
        isLoadingTeams={isLoadingTeams}
        setIsCreateModalOpen={setIsCreateModalOpen}
        renderCreateTeamModal={renderCreateTeamModal}
      />
    );
  }

  // ==================== VIEW 1: ACTIVE SIMULATION COCKPIT VIEW ====================
  const waterfallSteps = [
    { title: '召集项目会议', text: 'PM 正在召集项目会议...' },
    { title: '物理入驻集结', text: '项目组成员正在前往会议室...' },
    { title: '制定分工大纲', text: '制定项目开发大纲与分工...' },
    { title: '数据库Schema设计', text: '老陈回到工位，设计数据库元数据...' },
    { title: '表模型终审', text: '表结构设计完成，等待老板审批...' },
    { title: '表单与API开发', text: '小张正在封装表单并调用 API 生成数据表...' },
    { title: '创建写入物理表', text: '正在将创建出的表单写入低代码数据库...' },
    { title: '系统逻辑功能测试', text: '小李正在进行系统逻辑测试...' },
    { title: '验收测试通过庆祝', text: '测试与发布验收通过！全体庆祝！' },
    { title: '协同任务圆满完成', text: '虚拟项目组任务已圆满完成!' },
  ];

  const socialSteps = [
    { title: '宣发协同正式启动', text: 'PM 启动小红书自动宣发流程...' },
    { title: 'AI 爆款推广文案', text: 'AI 助手阿莉开始撰写宣发文案...' },
    { title: '初稿PM内容审核', text: '文案初稿撰写完成，交由 PM 老陆审核...' },
    { title: '文案老板最终终审', text: '宣发文案内容审核通过，等待老板最终确认...' },
    { title: 'API 接口宣发落地', text: '正在调用 API 发布...' },
    { title: '发布完成任务落幕', text: '小红书营销组发布任务圆满完成！' },
  ];

  const activeSteps = currentSOPMode === 'social' ? socialSteps : waterfallSteps;

  let activeIndex = activeSteps.findIndex((s) => {
    if (!currentMilestone) return false;
    return (
      currentMilestone.includes(s.text) ||
      s.text.includes(currentMilestone) ||
      currentMilestone.includes(s.title)
    );
  });

  if (activeIndex === -1) {
    if (!currentMilestone) {
      activeIndex = 0;
    } else {
      if (
        currentMilestone.includes('圆满完成') ||
        currentMilestone.includes('任务已圆满') ||
        currentMilestone.includes('庆祝')
      ) {
        activeIndex = activeSteps.length - 1;
      } else {
        activeIndex = 0;
      }
    }
  }

  const currentCeoAgent = agents.find((a) => a.id === ceoId || a.isCeo || a.role === 'CEO');

  return (
    <div className="agent-playroom-wrapper">
      {/* 1. Header Bar Area */}
      <PlayroomHeader
        activeTeamId={activeTeamId}
        teamsList={teamsList}
        loadExistingTeam={loadExistingTeam}
        setIsCreateModalOpen={setIsCreateModalOpen}
        currentCeoAgent={currentCeoAgent}
        agents={agents}
        isRunningSOP={isRunningSOP}
        waitingForBossApproval={waitingForBossApproval}
        currentMilestone={currentMilestone}
        approveMilestone={approveMilestone}
        isPlaying={isPlaying}
        pauseSOP={pauseSOP}
        resumeSOP={resumeSOP}
        removeTeam={removeTeam}
        siderCollapsed={siderCollapsed}
        setSiderCollapsed={setSiderCollapsed}
      />

      {/* 2. Primary Three Column Sandbox Body */}
      <div className="playroom-body">
        {/* Left wing tabs: progressive milestones and subtask kanban */}
        <PlayroomWorkspaceSidebarLeft
          activeSteps={activeSteps}
          activeIndex={activeIndex}
          tasks={tasks}
        />

        {/* Central sandbox and Canvas board */}
        <div className="playroom-center">
          <PlayroomPixelSandboxCanvas
            canvasRef={canvasRef}
            isPlaying={isPlaying}
            isRunningSOP={isRunningSOP}
            pauseSOP={pauseSOP}
            resumeSOP={resumeSOP}
            stepForward={stepForward}
            speed={speed}
            setSpeed={setSpeed}
          />

          <PlayroomBossInterventionPanel
            bossInput={bossInput}
            setBossInput={setBossInput}
            handleBossSend={handleBossSend}
            isRunningSOP={isRunningSOP}
          />
        </div>

        {/* Right wing tabs: artifacts decks and meeting terminal transcripts */}
        <PlayroomConsoleSidebarRight
          artifacts={artifacts}
          chatHistory={chatHistory}
          chatEndRef={chatEndRef}
        />
      </div>

      {renderCreateTeamModal()}
    </div>
  );
}

export default AgentPlayroom;
