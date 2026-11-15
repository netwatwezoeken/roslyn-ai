Comments are a code smell. Mostly they contain information that should be in the code.

Commenting rules:
- Code should be self explanatory
- Don't insult the reader
- Reference to issue in a ticket system belong in the commit message, not in comments
- There is no TODO, there is "DO NOW" or "DO NOT". Either fix the code now or leave it as is, never allow a TODO in comments.

The goal is to get rid of comments but keep the information.
Work through this list:
1. **Determine what is correct** Comment might contain intended or old behavior. If comments contradict code then ask the user what to do.
2. **Improve code readability by refactoring.** Any information in the comment but not in code deserves a place in code.
   1. A "Why" can often be refactored into a variable name or a method name. Introduce new variables or method can make code more readable.
   2. Tests of also give context on the "why". Add tests if they can help explain why a certain piece of code is there.
3. **Ticket reference**. Sometimes we want to keep track of why a change was intiated but that information does not belong in code.
4. **Remove comments that are made redundant by clear code.** Comments should never explain what is already obvious from code. Remove those