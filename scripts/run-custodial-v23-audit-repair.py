from pathlib import Path
import runpy

repair = Path('scripts/repair-custodial-v23-audit-findings.py')
source = repair.read_text()
anchor = source.index("'mode-specific confirmation contract'")
start = source.index('    source = replace_once(', anchor)
end = source.index('    return source', start)
replacement = '''    old_line = next(
        line for line in source.splitlines()
        if line.startswith("assert.doesNotMatch(app, /Message queued for retry:")
    )
    source = source.replace(
        old_line,
        "assert.match(app, /EMPLOYEE_CONTEXT \\? employeeSafeError\\(error, \\{ sending: true \\}\\) : `Message queued for retry:/, 'manager diagnostics must remain outside employee-safe copy');",
        1,
    )
'''
repair.write_text(source[:start] + replacement + source[end:])
runpy.run_path(str(repair), run_name='__main__')
