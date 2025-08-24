/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Box, Text } from 'ink';
import { Task, TaskList } from '@google/gemini-cli-core';

interface TaskListDisplayProps {
  taskList: TaskList | null;
  compact?: boolean;
}

export const TaskListDisplay: React.FC<TaskListDisplayProps> = ({ 
  taskList, 
  compact = false 
}) => {
  
  if (!taskList || taskList.status !== 'active') {
    return null;
  }

  const { tasks, currentTaskIndex } = taskList;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const totalCount = tasks.length;
  const progressPercentage = Math.round((completedCount / totalCount) * 100);

  const getStatusIcon = (task: Task, index: number) => {
    if (task.status === 'completed') {
      return <Text color="green">✓</Text>;
    } else if (task.status === 'failed') {
      return <Text color="red">✗</Text>;
    } else if (task.status === 'in_progress') {
      return <Text color="cyan">▶</Text>;
    } else if (index === currentTaskIndex) {
      return <Text color="yellow">○</Text>;
    } else {
      return <Text dimColor>○</Text>;
    }
  };

  if (compact) {
    // Compact view for header/footer
    const currentTask = tasks[currentTaskIndex];
    return (
      <Box flexDirection="row" gap={1}>
        <Text color={"blue"}>Tasks:</Text>
        <Text>{completedCount}/{totalCount}</Text>
        <Text dimColor>({progressPercentage}%)</Text>
        {currentTask && currentTask.status === 'in_progress' && (
          <>
            <Text dimColor>|</Text>
            <Text color={"cyan"}>{currentTask.title}</Text>
          </>
        )}
      </Box>
    );
  }

  // Full view
  return (
    <Box flexDirection="column" marginY={1}>
      <Box flexDirection="row" gap={1} marginBottom={1}>
        <Text bold color={"blue"}>Task Progress</Text>
        <Text>({completedCount}/{totalCount})</Text>
        <Text dimColor>{progressPercentage}%</Text>
      </Box>
      
      {/* Progress bar */}
      <Box marginBottom={1}>
        <Text>
          [
          {Array.from({ length: 20 }).map((_, i) => {
            const filled = i < Math.floor((completedCount / totalCount) * 20);
            return filled ? '█' : '░';
          }).join('')}
          ]
        </Text>
      </Box>

      {/* Task list */}
      <Box flexDirection="column">
        {tasks.map((task, index) => {
          const isCurrent = index === currentTaskIndex;
          const isActive = task.status === 'in_progress';
          
          return (
            <Box key={task.id} flexDirection="row" gap={1}>
              {getStatusIcon(task, index)}
              <Text
                bold={isActive}
                color={isActive ? "cyan" : isCurrent ? "yellow" : undefined}
                dimColor={task.status === 'completed' || index > currentTaskIndex}
              >
                {index + 1}. {task.title}
              </Text>
              {task.status === 'failed' && task.error && (
                <Text color={"red"} dimColor>({task.error})</Text>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Current task details */}
      {tasks[currentTaskIndex] && tasks[currentTaskIndex].status === 'in_progress' && (
        <Box marginTop={1} borderStyle="single" borderColor={"cyan"} paddingX={1}>
          <Text color={"cyan"}>
            Current: {tasks[currentTaskIndex].title}
          </Text>
        </Box>
      )}
    </Box>
  );
};