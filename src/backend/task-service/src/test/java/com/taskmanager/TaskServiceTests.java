package com.taskmanager;

import com.taskmanager.entities.Task;
import com.taskmanager.entities.Task.TaskStatus;
import com.taskmanager.entities.Task.TaskPriority;
import com.taskmanager.entities.Project;
import com.taskmanager.services.TaskService;
import com.taskmanager.repositories.TaskRepository;
import com.taskmanager.dto.TaskDTO;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.cache.CacheManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit.jupiter.SpringExtension;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Comprehensive test suite for TaskService validating core functionality,
 * performance requirements, and security constraints.
 */
@SpringBootTest
@ExtendWith(SpringExtension.class)
@TestPropertySource(locations = "classpath:application-test.yml")
public class TaskServiceTests {

    @Autowired
    private TaskService taskService;

    @MockBean
    private TaskRepository taskRepository;

    @MockBean
    private CacheManager cacheManager;

    private TestDataFactory testDataFactory;
    private SecurityContext securityContext;
    private Authentication authentication;

    @BeforeEach
    void setUp() {
        testDataFactory = new TestDataFactory();
        
        // Setup security context mock
        securityContext = mock(SecurityContext.class);
        authentication = mock(Authentication.class);
        when(securityContext.getAuthentication()).thenReturn(authentication);
        when(authentication.getName()).thenReturn("test-user");
        SecurityContextHolder.setContext(securityContext);

        // Clear caches
        when(cacheManager.getCache("projectTasks")).thenReturn(null);
        when(cacheManager.getCache("assigneeTasks")).thenReturn(null);
    }

    @Test
    void testCreateTask_Success() {
        // Arrange
        TaskDTO taskDTO = testDataFactory.createValidTaskDTO();
        Task expectedTask = testDataFactory.createTaskFromDTO(taskDTO);
        when(taskRepository.save(any(Task.class))).thenReturn(expectedTask);

        // Act
        Task createdTask = taskService.createTask(taskDTO);

        // Assert
        assertNotNull(createdTask);
        assertEquals(taskDTO.getTitle(), createdTask.getTitle());
        assertEquals(taskDTO.getStatus(), createdTask.getStatus());
        verify(taskRepository, times(1)).save(any(Task.class));
    }

    @Test
    void testCreateTask_ValidationFailure() {
        // Arrange
        TaskDTO invalidTaskDTO = testDataFactory.createInvalidTaskDTO();

        // Act & Assert
        assertThrows(IllegalArgumentException.class, () -> {
            taskService.createTask(invalidTaskDTO);
        });
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    void testUpdateTask_Success() {
        // Arrange
        UUID taskId = UUID.randomUUID();
        TaskDTO updateDTO = testDataFactory.createValidTaskDTO();
        updateDTO.setId(taskId);
        Task existingTask = testDataFactory.createTaskFromDTO(updateDTO);
        
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(existingTask));
        when(taskRepository.save(any(Task.class))).thenReturn(existingTask);

        // Act
        Task updatedTask = taskService.updateTask(updateDTO);

        // Assert
        assertNotNull(updatedTask);
        assertEquals(updateDTO.getTitle(), updatedTask.getTitle());
        assertEquals(updateDTO.getStatus(), updatedTask.getStatus());
        verify(taskRepository, times(1)).save(any(Task.class));
    }

    @Test
    void testGetProjectTasks_WithPagination() {
        // Arrange
        UUID projectId = UUID.randomUUID();
        PageRequest pageRequest = PageRequest.of(0, 10);
        List<Task> tasks = testDataFactory.createTaskList(10);
        Page<Task> taskPage = new PageImpl<>(tasks, pageRequest, tasks.size());
        
        when(taskRepository.findByProjectId(projectId, pageRequest)).thenReturn(taskPage);

        // Act
        Page<Task> result = taskService.getProjectTasks(projectId, pageRequest);

        // Assert
        assertEquals(10, result.getContent().size());
        assertEquals(1, result.getTotalPages());
        verify(taskRepository, times(1)).findByProjectId(projectId, pageRequest);
    }

    @Test
    void testCreateTaskWithConcurrency() throws Exception {
        // Arrange
        int numTasks = 100;
        List<TaskDTO> taskDTOs = IntStream.range(0, numTasks)
            .mapToObj(i -> testDataFactory.createValidTaskDTO())
            .collect(Collectors.toList());
        
        when(taskRepository.save(any(Task.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        ExecutorService executor = Executors.newFixedThreadPool(10);

        // Act
        List<CompletableFuture<Task>> futures = taskDTOs.stream()
            .map(dto -> CompletableFuture.supplyAsync(
                () -> taskService.createTask(dto), executor))
            .collect(Collectors.toList());

        List<Task> createdTasks = futures.stream()
            .map(CompletableFuture::join)
            .collect(Collectors.toList());

        // Assert
        assertEquals(numTasks, createdTasks.size());
        verify(taskRepository, times(numTasks)).save(any(Task.class));
        
        executor.shutdown();
    }

    @Test
    void testTaskAccessControl() {
        // Arrange
        UUID taskId = UUID.randomUUID();
        TaskDTO taskDTO = testDataFactory.createValidTaskDTO();
        taskDTO.setId(taskId);
        
        // Mock unauthorized user
        when(authentication.getName()).thenReturn("unauthorized-user");
        
        // Act & Assert
        assertThrows(SecurityException.class, () -> {
            taskService.updateTask(taskDTO);
        });
        
        // Mock authorized user
        when(authentication.getName()).thenReturn("test-user");
        when(taskRepository.findById(taskId))
            .thenReturn(Optional.of(testDataFactory.createTaskFromDTO(taskDTO)));
        
        // Act
        Task updatedTask = taskService.updateTask(taskDTO);
        
        // Assert
        assertNotNull(updatedTask);
        assertEquals("test-user", updatedTask.getLastModifiedBy());
    }

    @Test
    void testCacheEffectiveness() {
        // Arrange
        UUID projectId = UUID.randomUUID();
        PageRequest pageRequest = PageRequest.of(0, 10);
        List<Task> tasks = testDataFactory.createTaskList(10);
        Page<Task> taskPage = new PageImpl<>(tasks, pageRequest, tasks.size());
        
        when(taskRepository.findByProjectId(projectId, pageRequest))
            .thenReturn(taskPage);

        // Act - First call should hit database
        Page<Task> result1 = taskService.getProjectTasks(projectId, pageRequest);
        
        // Second call should hit cache
        Page<Task> result2 = taskService.getProjectTasks(projectId, pageRequest);

        // Assert
        assertEquals(result1.getContent().size(), result2.getContent().size());
        verify(taskRepository, times(1)).findByProjectId(projectId, pageRequest);
    }

    @Test
    void testTaskStatusTransition() {
        // Arrange
        TaskDTO taskDTO = testDataFactory.createValidTaskDTO();
        taskDTO.setStatus(TaskStatus.COMPLETED);
        taskDTO.setCompletionPercentage(50.0);

        // Act & Assert
        assertThrows(IllegalStateException.class, () -> {
            taskService.createTask(taskDTO);
        });

        // Set valid completion percentage
        taskDTO.setCompletionPercentage(100.0);
        when(taskRepository.save(any(Task.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        // Act
        Task createdTask = taskService.createTask(taskDTO);

        // Assert
        assertNotNull(createdTask);
        assertEquals(TaskStatus.COMPLETED, createdTask.getStatus());
        assertEquals(100.0, createdTask.getCompletionPercentage());
    }

    @Test
    void testDeleteTask() {
        // Arrange
        UUID taskId = UUID.randomUUID();
        Task task = testDataFactory.createTask();
        when(taskRepository.findById(taskId)).thenReturn(Optional.of(task));

        // Act
        taskService.deleteTask(taskId);

        // Assert
        verify(taskRepository, times(1)).delete(task);
        verify(cacheManager.getCache("projectTasks"), times(1)).clear();
        verify(cacheManager.getCache("assigneeTasks"), times(1)).clear();
    }
}