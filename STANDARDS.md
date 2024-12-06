## Development Process

The project follows a structured development process with comprehensive documentation:

- **Change Tracking**: All changes are documented in `CHECKPOINT.md`
- **Development Guidelines**: Development instructions and standards are maintained in `cc-prompt.md`
- **Progress Chronicle**: Project evolution and features are tracked in `cc-chronicle.md`

# UX/UI Style Guidelines

**Important:** When being asked to implement a new feature, please consider how the user will interact with the tool.

1. Ensure that the UI is responsive and accessible for all users.
2. Provide clear and concise instructions for users to navigate the tool.
3. Use a color scheme that is visually appealing and easy to distinguish from the background.
4. Use a consistent color scheme across the entire application.
5. Use a consistent font across the entire application.
6. Use a consistent spacing and layout across the entire application.
7. Use a consistent UI theme across the entire application.

## Documentation Guidelines

When documenting the codebase, please ensure that the following guidelines are followed:
- **IMPORTANT:** The single most important piece of information to convey to the user is the purpose of the code.
- Documentation must be written in a clear and concise manner.
- All other documentation must be written in markdown.

## Coding Guidelines

When making changes to the codebase, please ensure that the following guidelines are followed:
- **Important:** Only the minimum necessary changes should be made to the codebase.
- Add semantic `data-kind` attributes to all top-level HTML elements for clarity and testability.
- When making files, please consider the following modern architecture principles:
   1. Split into feature-based modules:
      - Core logic
      - Event handlers
      - Types/interfaces
   2. Implement clean architecture:
      - Separate UI from business logic
      - Use consistent naming