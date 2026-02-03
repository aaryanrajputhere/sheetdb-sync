"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mysqlService = exports.MySQLService = void 0;
const database_1 = require("../config/database");
class MySQLService {
    async getUserById(id) {
        const [rows] = await database_1.pool.query("SELECT * FROM users WHERE id = ?", [id]);
        return rows.length > 0 ? rows[0] : null;
    }
    async createUser(data) {
        const [result] = await database_1.pool.query(`INSERT INTO users (name, age, version, source, last_modified_at) 
       VALUES (?, ?, ?, ?, NOW())`, [data.name, data.age, data.version, data.source]);
        return result.insertId;
    }
    async updateUser(id, data) {
        const [result] = await database_1.pool.query(`UPDATE users 
       SET name = ?, age = ?, version = ?, source = ?, last_modified_at = NOW() 
       WHERE id = ?`, [data.name, data.age, data.version, data.source, id]);
        return result.affectedRows > 0;
    }
    async deleteUser(id) {
        const [result] = await database_1.pool.query("DELETE FROM users WHERE id = ?", [id]);
        return result.affectedRows > 0;
    }
    async getUserByVersion(id, version) {
        const [rows] = await database_1.pool.query("SELECT * FROM users WHERE id = ? AND version = ?", [id, version]);
        return rows.length > 0 ? rows[0] : null;
    }
}
exports.MySQLService = MySQLService;
exports.mysqlService = new MySQLService();
