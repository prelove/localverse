package process;

/**
 * Script task executor that evaluates simple expressions
 */
public class ScriptTaskExecutor implements TaskExecutor {
    @Override
    public Object execute(TaskInstance task, ProcessInstance process) throws Exception {
        String script = (String) task.getConfig().get("script");
        if (script == null) {
            throw new IllegalArgumentException("Script task requires 'script' config");
        }
        
        // Simple variable substitution
        String result = script;
        for (var entry : process.getVariables().entrySet()) {
            result = result.replace("${" + entry.getKey() + "}", String.valueOf(entry.getValue()));
        }
        
        // Store result in variable if specified
        String outputVar = (String) task.getConfig().get("outputVariable");
        if (outputVar != null) {
            process.setVariable(outputVar, result);
        }
        
        return result;
    }
}
