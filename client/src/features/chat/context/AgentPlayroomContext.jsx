import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { message } from 'antd';
import {
  findPath,
  LOCATIONS,
  isWalkable,
  TILE_SIZE,
} from '../../chat/components/PixelOfficeEngine';
import useAppStore from '../../../store/useAppStore';
import { getDigitalEmployees, createDigitalEmployee } from '../../../api/digital-employees';
import { getAgentTeams, createAgentTeam, deleteAgentTeam } from '../../../api/agent-teams';

export const AgentPlayroomContext = createContext(null);

export const useAgentPlayroom = () => {
  const context = useContext(AgentPlayroomContext);
  if (!context) {
    throw new Error('useAgentPlayroom must be used within an AgentPlayroomProvider');
  }
  return context;
};

export function AgentPlayroomProvider({ children }) {
  const appId = useAppStore((state) => state.currentAppId);
  const [availableAgents, setAvailableAgents] = useState([]);
  
  // Persistent Team Sandbox states
  const [teamsList, setTeamsList] = useState([]);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState(null);

  const fetchTeams = useCallback(async () => {
    if (!appId) return;
    setIsLoadingTeams(true);
    try {
      const res = await getAgentTeams(appId);
      const list = res?.data || res || [];
      setTeamsList(list);

      // Robust fallback: If database teams list is physically empty, immediately collapse all sandbox sessions
      if (list.length === 0) {
        setActiveTeamId(null);
        setIsRunningSOP(false);
        setTeamName('');
        setCeoId('');
        setAgents([]);
        setTasks([]);
        setArtifacts([]);
        setChatHistory([]);
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('加载项目组列表失败:', err);
      setTeamsList([]);
    } finally {
      setIsLoadingTeams(false);
    }
  }, [appId]);

  useEffect(() => {
    fetchTeams();
  }, [appId, fetchTeams]);

  useEffect(() => {
    if (!appId) return;

    const fetchAgents = async () => {
      try {
        const res = await getDigitalEmployees(appId);
        let list = res || [];

        // 进行名字严格去重，防止同一应用内出现多重重名或竞态写入导致的列表重叠显示
        const uniqueList = [];
        const seenNames = new Set();
        list.forEach((item) => {
          if (item && item.name && !seenNames.has(item.name)) {
            seenNames.add(item.name);
            uniqueList.push(item);
          }
        });

        const DESK_POOLS = [
          { deskX: 7, deskY: 2 },
          { deskX: 12, deskY: 2 },
          { deskX: 2, deskY: 6 },
          { deskX: 17, deskY: 6 },
          { deskX: 2, deskY: 9 },
          { deskX: 17, deskY: 9 },
          { deskX: 7, deskY: 9 },
          { deskX: 12, deskY: 9 },
        ];

        const formatted = uniqueList.map((item, index) => {
          const desk = DESK_POOLS[index % DESK_POOLS.length];
          return {
            id: item.id || item._id,
            name: item.name,
            role: item.roleTitle || 'Developer',
            x: desk.deskX,
            y: desk.deskY,
            targetX: desk.deskX,
            targetY: desk.deskY,
            deskX: desk.deskX,
            deskY: desk.deskY,
            state: 'SLACKING',
            path: [],
            speechText: null,
            description: item.description || '',
          };
        });

        setAvailableAgents(formatted);
      } catch (error) {
        console.error('加载真实数字员工列表出错:', error);
        // 遵循严格的“删除mock数据，不使用mock数据后备”指示，报错或为空时仅暴露空列表
        setAvailableAgents([]);
      }
    };

    fetchAgents();
  }, [appId]);

  const [agents, setAgents] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [ceoId, setCeoId] = useState('');
  const [tasks, setTasks] = useState([]);
  const [artifacts, setArtifacts] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1); // 1 = Normal, 2 = Fast, 4 = Turbo
  const [currentSOPMode, setCurrentSOPMode] = useState('waterfall'); // waterfall, social, debate
  const [isRunningSOP, setIsRunningSOP] = useState(false);
  const [currentMilestone, setCurrentMilestone] = useState('');
  const [waitingForBossApproval, setWaitingForBossApproval] = useState(false);

  // Simulation timeline references
  const scriptIndexRef = useRef(0);
  const scriptRef = useRef([]);
  const ticksRef = useRef(0);
  const activeSOPRef = useRef(false);

  // ─────────────────────────────────────────────
  // 1. Smooth Avatar Interpolation & Walk Tick Loop
  // ─────────────────────────────────────────────
  useEffect(() => {
    let frameId;

    const updatePhysics = () => {
      setAgents((prevAgents) =>
        prevAgents.map((agent) => {
          if (!agent.path || agent.path.length === 0) {
            // Keep matching target coords
            return {
              ...agent,
              x: agent.targetX,
              y: agent.targetY,
            };
          }

          // Step distance per frame (adjusted by speed settings)
          const stepSize = 0.08 * speed;
          const currentTarget = agent.path[0];

          let nextX = agent.x;
          let nextY = agent.y;

          const dx = currentTarget.x - agent.x;
          const dy = currentTarget.y - agent.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= stepSize) {
            // Reached next node in path
            nextX = currentTarget.x;
            nextY = currentTarget.y;
            const updatedPath = agent.path.slice(1);

            return {
              ...agent,
              x: nextX,
              y: nextY,
              targetX: nextX,
              targetY: nextY,
              path: updatedPath,
            };
          } else {
            // Smooth float stepping
            nextX += (dx / distance) * stepSize;
            nextY += (dy / distance) * stepSize;

            return {
              ...agent,
              x: nextX,
              y: nextY,
            };
          }
        }),
      );

      frameId = requestAnimationFrame(updatePhysics);
    };

    frameId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(frameId);
  }, [speed]);

  // 统一智能别名匹配定位器，保证数据库 UUID 真实数字员工能完美被脚本指令所调度
  const findRealAgentId = useCallback((prevAgents, idOrAlias) => {
    if (!idOrAlias) return idOrAlias;
    if (prevAgents.some((a) => a.id === idOrAlias)) {
      return idOrAlias;
    }
    
    const aliasMap = {
      'pm-lu': ['CEO', 'PM'],
      'coder-zhang': ['Developer', 'coder'],
      'arch-chen': ['Architect', 'arch'],
      'tester-li': ['Tester', 'tester'],
      'assist-ali': ['General', 'assist']
    };

    const targetRoles = aliasMap[idOrAlias];
    if (targetRoles) {
      const matched = prevAgents.find((a) => targetRoles.includes(a.role));
      if (matched) {
        return matched.id;
      }
    }
    return idOrAlias;
  }, []);

  // Helper to assign a coordinate target destination using A*
  const sendAgentTo = useCallback((agentId, targetX, targetY, newState = null) => {
    setAgents((prev) => {
      const realId = findRealAgentId(prev, agentId);
      if (!prev.some((a) => a.id === realId)) return prev;
      return prev.map((agent) => {
        if (agent.id !== realId) return agent;

        const startX = Math.round(agent.targetX);
        const startY = Math.round(agent.targetY);
        const calculatedPath = findPath(startX, startY, targetX, targetY);

        return {
          ...agent,
          targetX:
            calculatedPath.length > 0 ? calculatedPath[calculatedPath.length - 1].x : agent.targetX,
          targetY:
            calculatedPath.length > 0 ? calculatedPath[calculatedPath.length - 1].y : agent.targetY,
          path: calculatedPath,
          state: newState || agent.state,
        };
      });
    });
  }, [findRealAgentId]);

  // Helper to clear bubble
  const clearAgentSpeech = useCallback((agentId) => {
    setAgents((prev) => {
      const realId = findRealAgentId(prev, agentId);
      return prev.map((agent) => (agent.id === realId ? { ...agent, speechText: null } : agent));
    });
  }, [findRealAgentId]);

  // Helper to trigger speech bubbles
  const makeAgentSpeak = useCallback(
    (agentId, text, duration = 4000) => {
      setAgents((prev) => {
        const realId = findRealAgentId(prev, agentId);
        if (!prev.some((a) => a.id === realId)) return prev;

        const speaker = prev.find((a) => a.id === realId);
        if (speaker) {
          // Push setChatHistory side-effect to macro-task queue to completely bypass React updater double-runs
          setTimeout(() => {
            setChatHistory((hist) => [
              ...hist,
              {
                id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                speaker: speaker.name,
                role: speaker.role,
                text,
                timestamp: new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }),
              },
            ]);
          }, 0);
        }

        return prev.map((agent) => (agent.id === realId ? { ...agent, speechText: text } : agent));
      });

      // Automatically fade out speech bubble after timeout
      if (duration > 0) {
        setTimeout(() => {
          clearAgentSpeech(agentId);
        }, duration);
      }
    },
    [clearAgentSpeech, findRealAgentId],
  );

  // ─────────────────────────────────────────────
  // 2. SOP Scenario Script Simulator Definition
  // ─────────────────────────────────────────────

  // Waterfall AINote Script
  const generateWaterfallScript = () => [
    {
      tick: 5,
      action: () => {
        setCurrentMilestone('PM 正在召集项目会议...');
        sendAgentTo('pm-lu', LOCATIONS.MEETING[0].x, LOCATIONS.MEETING[0].y, 'DEBATING');
        makeAgentSpeak(
          'pm-lu',
          '各位伙伴！我们刚接到客户任务：开发【图书管理系统】！大家来会议桌讨论一下！',
        );
      },
    },
    {
      tick: 35,
      action: () => {
        setCurrentMilestone('项目组成员正在前往会议室...');
        sendAgentTo('coder-zhang', LOCATIONS.MEETING[1].x, LOCATIONS.MEETING[1].y, 'DEBATING');
        sendAgentTo('arch-chen', LOCATIONS.MEETING[2].x, LOCATIONS.MEETING[2].y, 'DEBATING');
        sendAgentTo('tester-li', LOCATIONS.MEETING[3].x, LOCATIONS.MEETING[3].y, 'DEBATING');
        sendAgentTo('assist-ali', LOCATIONS.MEETING[4].x, LOCATIONS.MEETING[4].y, 'DEBATING');

        setTasks([
          { id: 't1', title: '系统架构与数据库结构设计', state: 'todo' },
          { id: 't2', title: '表单页面及前后端 API 开发', state: 'todo' },
          { id: 't3', title: '系统级功能测试与发布验收', state: 'todo' },
        ]);
      },
    },
    {
      tick: 90,
      action: () => {
        setCurrentMilestone('制定项目开发大纲与分工...');
        makeAgentSpeak(
          'pm-lu',
          '分工明确：老陈负责数据库 Schema，小张开发接口，小李把控质检！',
          5000,
        );
      },
    },
    {
      tick: 130,
      action: () => {
        makeAgentSpeak('arch-chen', '没问题，我立刻开始设计表模型 DDL！', 3000);
        makeAgentSpeak('coder-zhang', '收到！我准备写数据绑定表单和视图！', 3000);
      },
    },
    {
      tick: 180,
      action: () => {
        setCurrentMilestone('老陈回到工位，设计数据库元数据...');
        sendAgentTo('pm-lu', 7, 2, 'SLACKING');
        sendAgentTo('coder-zhang', 12, 2, 'SLACKING');
        sendAgentTo('tester-li', 17, 6, 'SLACKING');
        sendAgentTo('assist-ali', 2, 9, 'SLACKING');

        // Architect returns to desk and codes
        sendAgentTo('arch-chen', 2, 6, 'WORKING');
        setTasks((prev) => prev.map((t) => (t.id === 't1' ? { ...t, state: 'progress' } : t)));
      },
    },
    {
      tick: 240,
      action: () => {
        makeAgentSpeak('arch-chen', '正在生成 JSON 形式的低代码数据模型...', 4000);
      },
    },
    {
      tick: 300,
      action: () => {
        setCurrentMilestone('里程碑触发：表结构设计完成，等待老板审批...');
        setIsPlaying(false); // Pause execution for Human Gate
        setWaitingForBossApproval(true);
      },
    },
    // --- User Clicks "Approve" (Script resumes here) ---
    {
      tick: 310,
      action: () => {
        setWaitingForBossApproval(false);
        setCurrentMilestone('老板审批通过！开发工程师开始实施...');
        setTasks((prev) =>
          prev.map((t) =>
            t.id === 't1'
              ? { ...t, state: 'done' }
              : t.id === 't2'
                ? { ...t, state: 'progress' }
                : t,
          ),
        );
        sendAgentTo('coder-zhang', 12, 2, 'WORKING');
        makeAgentSpeak('coder-zhang', 'OK！收到批准！开始构建前端 Form 表单和 Node 接口！', 4500);
      },
    },
    {
      tick: 380,
      action: () => {
        setCurrentMilestone('小张正在封装表单并调用 API 生成数据表...');
        makeAgentSpeak(
          'coder-zhang',
          '我需要到打印机房，正式把【图书库主表】Schema 编译落盘！',
          4000,
        );
        sendAgentTo('coder-zhang', LOCATIONS.PRINTER.x, LOCATIONS.PRINTER.y, 'OUTPUTTING');
      },
    },
    {
      tick: 430,
      action: () => {
        // Printer sparks, output printed
        setCurrentMilestone('正在将创建出的表单写入低代码数据库...');
        message.loading('物理表创建中...', 1.5);
        setArtifacts((art) => [
          ...art,
          {
            id: 'art-books-table',
            title: '低代码物理表: app_books_table',
            type: 'table',
            content:
              '已成功创建表单 `图书库主表`，包含字段：id (主键), title (书名), author (作者), status (在库/借出)。',
            creator: '小张',
            createdAt: new Date().toLocaleTimeString(),
          },
        ]);
      },
    },
    {
      tick: 470,
      action: () => {
        makeAgentSpeak('coder-zhang', '物理表单已交付！小李，开始测试！', 3500);
        sendAgentTo('coder-zhang', 12, 2, 'SLACKING');
        sendAgentTo('tester-li', 17, 6, 'WORKING');
        setTasks((prev) =>
          prev.map((t) =>
            t.id === 't2'
              ? { ...t, state: 'done' }
              : t.id === 't3'
                ? { ...t, state: 'progress' }
                : t,
          ),
        );
      },
    },
    {
      tick: 520,
      action: () => {
        setCurrentMilestone('小李正在进行系统逻辑测试...');
        makeAgentSpeak('tester-li', '正在模拟用户借书、还书，触发自动扣减和校验流...', 4500);
      },
    },
    {
      tick: 580,
      action: () => {
        setCurrentMilestone('测试与发布验收通过！全体庆祝！');
        setTasks((prev) => prev.map((t) => (t.id === 't3' ? { ...t, state: 'done' } : t)));
        sendAgentTo('tester-li', 17, 6, 'SLACKING');

        // Coder and Architect walk to coffee corner to slack off
        sendAgentTo('coder-zhang', LOCATIONS.COFFEE.x, LOCATIONS.COFFEE.y, 'SLACKING');
        sendAgentTo('arch-chen', LOCATIONS.COFFEE.x, LOCATIONS.COFFEE.y, 'SLACKING');

        makeAgentSpeak(
          'pm-lu',
          '大功告成！【图书管理系统】成功交付！晚上老规矩老陈请客喝手冲咖啡 ☕',
          6000,
        );
        makeAgentSpeak('coder-zhang', '哇塞，这次的苏门答腊耶加雪菲真的很棒！☕', 4000);
      },
    },
    {
      tick: 650,
      action: () => {
        setCurrentMilestone('虚拟项目组任务已圆满完成！');
        setIsPlaying(false);
        setIsRunningSOP(false);
        activeSOPRef.current = false;
      },
    },
  ];

  // Xiaohongshu Marketing Group Script
  const generateSocialScript = () => [
    {
      tick: 5,
      action: () => {
        setCurrentMilestone('PM 启动小红书自动宣发流程...');
        sendAgentTo('pm-lu', LOCATIONS.MEETING[0].x, LOCATIONS.MEETING[0].y, 'DEBATING');
        makeAgentSpeak(
          'pm-lu',
          '阿莉，今天的小红书宣发主题是：【如何十分钟无码设计企业报表】！开始创作！',
        );
      },
    },
    {
      tick: 35,
      action: () => {
        setCurrentMilestone('AI 助手阿莉开始撰写宣发文案...');
        setTasks([
          { id: 'ts1', title: '撰写低代码报表吸睛文案', state: 'todo' },
          { id: 'ts2', title: '审核文案内容及敏感词', state: 'todo' },
          { id: 'ts3', title: '一键分发到小红书平台', state: 'todo' },
        ]);
        sendAgentTo('assist-ali', 2, 9, 'WORKING');
        setTasks((prev) => prev.map((t) => (t.id === 'ts1' ? { ...t, state: 'progress' } : t)));
      },
    },
    {
      tick: 90,
      action: () => {
        makeAgentSpeak('assist-ali', '正在撰写具有小红书网感、自带表情包的爆款文案...', 4500);
      },
    },
    {
      tick: 150,
      action: () => {
        setCurrentMilestone('文案初稿撰写完成，交由 PM 老陆审核...');
        sendAgentTo('assist-ali', LOCATIONS.MEETING[4].x, LOCATIONS.MEETING[4].y, 'DEBATING');
        makeAgentSpeak('assist-ali', '老陆，初稿已经写好，你看看语气和排版是否合适？', 4500);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === 'ts1'
              ? { ...t, state: 'done' }
              : t.id === 'ts2'
                ? { ...t, state: 'progress' }
                : t,
          ),
        );
      },
    },
    {
      tick: 200,
      action: () => {
        makeAgentSpeak('pm-lu', '我看看。嗯，“震惊！程序员哭了...”这个开头很棒，批准发布！', 5000);
      },
    },
    {
      tick: 240,
      action: () => {
        setCurrentMilestone('里程碑触发：宣发文案内容审核通过，等待老板最终确认...');
        setIsPlaying(false);
        setWaitingForBossApproval(true);
      },
    },
    // --- User Clicks "Approve" (Script resumes here) ---
    {
      tick: 250,
      action: () => {
        setWaitingForBossApproval(false);
        setCurrentMilestone('老板最终发布指示下达！正在调用 API 发布...');
        setTasks((prev) =>
          prev.map((t) =>
            t.id === 'ts2'
              ? { ...t, state: 'done' }
              : t.id === 'ts3'
                ? { ...t, state: 'progress' }
                : t,
          ),
        );
        sendAgentTo('assist-ali', LOCATIONS.PRINTER.x, LOCATIONS.PRINTER.y, 'OUTPUTTING');
        makeAgentSpeak('assist-ali', '好嘞！正在通过 API 网关向小红书发布实时推文！', 4000);
      },
    },
    {
      tick: 300,
      action: () => {
        message.success('小红书接口分发成功！');
        setArtifacts((art) => [
          ...art,
          {
            id: 'art-xhs-post',
            title: '小红书推文: app_xhs_report_10min',
            type: 'post',
            content:
              '📌 小红书正文：【程序员彻底哭了😭】如何用低代码在10分钟内撸出一个企业级可视化大屏报表？内含实操攻略，建议收藏！#低代码 #可视化报表 #无代码开发',
            creator: '阿莉',
            createdAt: new Date().toLocaleTimeString(),
          },
        ]);
        setTasks((prev) => prev.map((t) => (t.id === 'ts3' ? { ...t, state: 'done' } : t)));
      },
    },
    {
      tick: 340,
      action: () => {
        setCurrentMilestone('小红书营销组发布任务圆满完成！');
        sendAgentTo('assist-ali', 2, 9, 'SLACKING');
        sendAgentTo('pm-lu', 7, 2, 'SLACKING');
        makeAgentSpeak('pm-lu', '推文已发布！大家今天表现很棒，休息一下！', 4000);
        setIsPlaying(false);
        setIsRunningSOP(false);
        activeSOPRef.current = false;
      },
    },
  ];

  // ─────────────────────────────────────────────
  // 3. Tick Timer Loop and Playback Controllers
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || !activeSOPRef.current) return;

    const interval = setInterval(() => {
      ticksRef.current += 1;

      // Look up and execute scheduled script actions at the exact tick
      const currentAction = scriptRef.current.find((s) => s.tick === ticksRef.current);
      if (currentAction) {
        currentAction.action();
      }
    }, 100); // 100ms per simulated tick

    return () => clearInterval(interval);
  }, [isPlaying]);

  const startSOPTask = useCallback(
    async (name, ceo, selectedAgentIds = []) => {
      // 1. 调用后端 API 将协同项目组记录入库！
      let createdTeam = null;
      try {
        const res = await createAgentTeam(appId, {
          name,
          ceoEmployeeId: ceo,
          memberEmployeeIds: selectedAgentIds,
          conversationId: `conv-team-${Date.now()}`,
        });
        createdTeam = res?.data || res;
        fetchTeams();
      } catch (err) {
        console.error('持久化创建项目组出错:', err);
        message.info('项目组数据已激活（临时内存协同中）');
      }

      // Reset all assets, chat histories and states
      setTasks([]);
      setArtifacts([]);
      setChatHistory([]);
      setWaitingForBossApproval(false);
      setCurrentMilestone('');

      setTeamName(name);
      setCeoId(ceo);
      if (createdTeam) {
        setActiveTeamId(createdTeam.id);
      }

      // Ensure CEO is in selected agents
      const uniqueIds = Array.from(new Set([ceo, ...selectedAgentIds]));

      // Reposition selected agents to their respective office workstations
      const filtered = availableAgents.filter((a) => uniqueIds.includes(a.id));
      setAgents(
        filtered.map((a) => {
          const isCeo = a.id === ceo;
          return {
            ...a,
            name: isCeo ? `👑 ${a.name}` : a.name,
            role: isCeo ? 'CEO' : a.role,
            x: a.deskX,
            y: a.deskY,
            targetX: a.deskX,
            targetY: a.deskY,
            state: 'SLACKING', // 默认所有加入的小人都是摸鱼状态
            path: [],
            speechText: null,
          };
        }),
      );

      // 智能感知 CEO 的角色背景特长以控制决定流程 SOP！
      const activeCeo = availableAgents.find((a) => a.id === ceo);
      const ceoRole = (activeCeo?.role || '').toLowerCase().trim();

      // 如果 CEO 属于 general/营销/辅助，自动匹配跑小红书营销 SOP；若属于 PM/Dev/Arch 等，跑软件开发 SOP
      let finalMode = 'waterfall';
      if (ceoRole === 'general' || ceoRole === 'assist' || ceoRole === 'marketing') {
        finalMode = 'social';
      }

      setCurrentSOPMode(finalMode);
      setIsRunningSOP(true);
      activeSOPRef.current = true;
      ticksRef.current = 0;

      // Select script based on the dynamically determined mode
      if (finalMode === 'social') {
        scriptRef.current = generateSocialScript();
      } else {
        scriptRef.current = generateWaterfallScript();
      }

      setIsPlaying(true);
      message.success(`成功创建项目组"${name}"！已直接进入办公室协同场景！`);
    },
    [appId, availableAgents, fetchTeams],
  );

  const loadExistingTeam = useCallback(
    (team, silent = false) => {
      if (!team) return;

      setTeamName(team.name);
      setCeoId(team.ceoEmployeeId);
      setActiveTeamId(team.id);
      setTasks([]);
      setArtifacts([]);
      setChatHistory([]);
      setWaitingForBossApproval(false);
      setCurrentMilestone('');

      // 组装并恢复成员
      const uniqueIds = Array.from(new Set([team.ceoEmployeeId, ...(team.memberEmployeeIds || [])]));
      const filtered = availableAgents.filter((a) => uniqueIds.includes(a.id));

      setAgents(
        filtered.map((a) => {
          const isCeo = a.id === team.ceoEmployeeId;
          return {
            ...a,
            name: isCeo ? `👑 ${a.name}` : a.name,
            role: isCeo ? 'CEO' : a.role,
            x: a.deskX,
            y: a.deskY,
            targetX: a.deskX,
            targetY: a.deskY,
            state: 'SLACKING',
            path: [],
            speechText: null,
          };
        }),
      );

      // 智能感知 CEO 角色以选择对应 SOP
      const activeCeo = availableAgents.find((a) => a.id === team.ceoEmployeeId);
      const ceoRole = (activeCeo?.role || '').toLowerCase().trim();
      let finalMode = 'waterfall';
      if (ceoRole === 'general' || ceoRole === 'assist' || ceoRole === 'marketing') {
        finalMode = 'social';
      }

      setCurrentSOPMode(finalMode);
      setIsRunningSOP(true);
      activeSOPRef.current = true;
      ticksRef.current = 0;

      if (finalMode === 'social') {
        scriptRef.current = generateSocialScript();
      } else {
        scriptRef.current = generateWaterfallScript();
      }

      setIsPlaying(true);
      
      if (!silent) {
        message.success(`已成功恢复历史项目组 "${team.name}" 的圆桌会！`);
      }
    },
    [availableAgents],
  );

  const removeTeam = useCallback(
    async (id) => {
      if (!appId) return;
      try {
        await deleteAgentTeam(appId, id);
        message.success('协同项目组已成功物理解散并删除！');
        
        // Cascade: If the deleted team is the active one, clear active state immediately
        if (id === activeTeamId) {
          setActiveTeamId(null);
          setIsRunningSOP(false);
          setTeamName('');
          setCeoId('');
          setAgents([]);
          setTasks([]);
          setArtifacts([]);
          setChatHistory([]);
          setIsPlaying(false);
        }
        
        await fetchTeams();
      } catch (err) {
        console.error('删除项目组失败:', err);
        message.error('解散并删除项目组失败');
      }
    },
    [appId, activeTeamId, fetchTeams],
  );

  const pauseSOP = useCallback(() => {
    setIsPlaying(false);
    message.info('仿真已暂停');
  }, []);

  const resumeSOP = useCallback(() => {
    setIsPlaying(true);
    message.info('继续仿真');
  }, []);

  const stepForward = useCallback(() => {
    ticksRef.current += 5;
    const nextActions = scriptRef.current.filter(
      (s) => s.tick > ticksRef.current - 5 && s.tick <= ticksRef.current,
    );
    nextActions.forEach((act) => act.action());
    message.info('手动单步前推');
  }, []);

  const setSpeedMultiplier = useCallback((multiplier) => {
    setSpeed(multiplier);
    message.success(`倍速已调整为: ${multiplier}x`);
  }, []);

  // BOSS Milestone Approval Gate Trigger
  const approveMilestone = useCallback(() => {
    if (!waitingForBossApproval) return;

    // Resume playback and skip one tick ahead to trigger execution
    setWaitingForBossApproval(false);
    setIsPlaying(true);
    message.success('老板已审批，下发批准开发/发布指令！');

    // Simulate clicking approve, let CEO speak dynamically
    const currentCeo = agents.find((a) => a.role === 'CEO' || a.id === ceoId);
    const speakerId = currentCeo ? currentCeo.id : agents[0]?.id || 'pm-lu';
    makeAgentSpeak(speakerId, '老板已经批准了！大家全力全速冲刺，继续前进！', 4000);
  }, [waitingForBossApproval, makeAgentSpeak, agents, ceoId]);

  // BOSS Real-time Text Override Intervention
  const injectBossCommand = useCallback(
    (text) => {
      if (!text.trim()) return;

      // Boss comment bubbles saved in chat stream as system override
      setChatHistory((hist) => [
        ...hist,
        {
          id: `boss-msg-${Date.now()}`,
          speaker: '老板 (您)',
          role: 'BOSS',
          text,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
        },
      ]);

      // Triggers active speech reply from the PM/CEO agent reacting to boss commands
      const currentCeo = agents.find((a) => a.role === 'CEO' || a.id === ceoId);
      const speakerId = currentCeo ? currentCeo.id : agents[0]?.id || 'pm-lu';

      // Find another developer/employee to react
      const otherAgent = agents.find((a) => a.id !== speakerId);
      const otherSpeakerId = otherAgent ? otherAgent.id : 'coder-zhang';

      setTimeout(() => {
        makeAgentSpeak(
          speakerId,
          `收到老板批示：“${text}”！大伙儿听到了吗？立刻根据老板意见作出调整！`,
          6000,
        );

        setTimeout(() => {
          makeAgentSpeak(otherSpeakerId, '收到！我马上调整这部分的数据流，绝不耽误交付！', 5000);
        }, 5000);
      }, 1500);

      message.success('老板意见已下达到项目组中！');
    },
    [makeAgentSpeak, agents, ceoId],
  );

  const resetPlayroom = useCallback(() => {
    setIsPlaying(false);
    setIsRunningSOP(false);
    activeSOPRef.current = false;
    ticksRef.current = 0;
    setAgents([]);
    setTeamName('');
    setCeoId('');
    setTasks([]);
    setArtifacts([]);
    setChatHistory([]);
    setWaitingForBossApproval(false);
    setCurrentMilestone('');
    message.info('已结束当前项目组协同并重置沙盘');
  }, []);

  const value = {
    agents,
    availableAgents,
    teamName,
    ceoId,
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
    resetPlayroom,
    pauseSOP,
    resumeSOP,
    stepForward,
    setSpeed: setSpeedMultiplier,
    approveMilestone,
    injectBossCommand,
    
    // 导出项目组持久化状态及操作
    teamsList,
    isLoadingTeams,
    activeTeamId,
    loadExistingTeam,
    removeTeam,
  };

  return <AgentPlayroomContext.Provider value={value}>{children}</AgentPlayroomContext.Provider>;
}
