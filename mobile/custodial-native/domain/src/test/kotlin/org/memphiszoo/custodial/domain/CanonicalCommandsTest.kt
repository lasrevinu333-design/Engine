package org.memphiszoo.custodial.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class CanonicalCommandsTest {
    @Test fun startBytesAreStableAndSorted() {
        val first = CanonicalCommands.start("op", "snap", "occ", 1, "scan", "emp", "dev", "loc", 123)
        val second = CanonicalCommands.start("op", "snap", "occ", 1, "scan", "emp", "dev", "loc", 123)
        assertEquals(first.decodeToString(), second.decodeToString())
        assertEquals('{', first.decodeToString().first())
        assertFalse(first.decodeToString().contains(" "))
    }

    @Test fun finishEscapesEmployeeNoteWithoutChangingShape() {
        val value = CanonicalCommands.finish("f", "s", "occ", 1, "scan", "draft", "emp", "dev", "loc", "Line 1\n\"soap\"", 456).decodeToString()
        assertEquals(true, value.contains("Line 1\\n\\\"soap\\\""))
        assertEquals(true, value.contains("\"standard_work_completed\":true"))
    }

    @Test fun operationIdsAreDeterministic() {
        assertEquals(StableOperationIds.derive("START", "scan", "snap"), StableOperationIds.derive("START", "scan", "snap"))
    }
}
