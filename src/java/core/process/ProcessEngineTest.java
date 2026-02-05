package process;

import java.util.List;
import java.util.Map;

/**
 * Simple test for Process Engine
 * Run with: java core.process.ProcessEngineTest
 */
public class ProcessEngineTest {
    
    public static void main(String[] args) throws Exception {
        System.out.println("=== Process Engine Test ===\n");
        
        ProcessEngine engine = new ProcessEngine();
        
        // Test 1: Simple Sequential Process
        System.out.println("Test 1: Simple Sequential Process");
        ProcessDefinition sequential = new ProcessDefinition(
            "test-sequential",
            "Test Sequential",
            "Sequential test process",
            "1.0.0",
            List.of(
                new TaskDefinition("task1", "First Task", "log", 
                    Map.of("message", "Task 1 executed"), null, null),
                new TaskDefinition("task2", "Second Task", "delay", 
                    Map.of("duration", 100), List.of("task1"), null),
                new TaskDefinition("task3", "Third Task", "log", 
                    Map.of("message", "Task 3 executed"), List.of("task2"), null)
            ),
            Map.of()
        );
        
        engine.registerDefinition(sequential);
        String instanceId1 = engine.startProcess("test-sequential", Map.of());
        System.out.println("Started process: " + instanceId1);
        
        // Wait and check status
        Thread.sleep(500);
        ProcessInstance instance1 = engine.getProcessInstance(instanceId1);
        System.out.println("Status: " + instance1.getStatus());
        System.out.println("Tasks completed: " + instance1.getTasks().values().stream()
            .filter(t -> t.getStatus() == TaskStatus.COMPLETED).count() + "/3");
        System.out.println();
        
        // Test 2: Parallel Tasks
        System.out.println("Test 2: Parallel Tasks");
        ProcessDefinition parallel = new ProcessDefinition(
            "test-parallel",
            "Test Parallel",
            "Parallel test process",
            "1.0.0",
            List.of(
                new TaskDefinition("init", "Init", "log", 
                    Map.of("message", "Starting parallel tasks"), null, null),
                new TaskDefinition("taskA", "Task A", "mock", 
                    Map.of("duration", 100), List.of("init"), null),
                new TaskDefinition("taskB", "Task B", "mock", 
                    Map.of("duration", 150), List.of("init"), null),
                new TaskDefinition("taskC", "Task C", "mock", 
                    Map.of("duration", 120), List.of("init"), null),
                new TaskDefinition("finish", "Finish", "log", 
                    Map.of("message", "All done"), List.of("taskA", "taskB", "taskC"), null)
            ),
            Map.of()
        );
        
        engine.registerDefinition(parallel);
        String instanceId2 = engine.startProcess("test-parallel", Map.of());
        System.out.println("Started process: " + instanceId2);
        
        // Wait and check status
        Thread.sleep(500);
        ProcessInstance instance2 = engine.getProcessInstance(instanceId2);
        System.out.println("Status: " + instance2.getStatus());
        System.out.println("Tasks completed: " + instance2.getTasks().values().stream()
            .filter(t -> t.getStatus() == TaskStatus.COMPLETED).count() + "/5");
        System.out.println();
        
        // Test 3: List all processes
        System.out.println("Test 3: List All Processes");
        List<ProcessInstance> processes = engine.listProcesses();
        System.out.println("Total processes: " + processes.size());
        for (ProcessInstance p : processes) {
            System.out.println("  - " + p.getName() + ": " + p.getStatus());
        }
        System.out.println();
        
        // Shutdown
        engine.shutdown();
        System.out.println("=== Tests Complete ===");
    }
}
