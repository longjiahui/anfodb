import del from 'rollup-plugin-delete'
import copy from 'rollup-plugin-copy'

export default {
    input: 'src/db.js',
    output: {
        dir: 'dist',
        format: 'umd',
        name: 'AnfoDB',
    },
    plugins: [
        del({targets: 'dist/*'}),
        copy({targets: [{
            src: 'src/debug.html',
            dest: 'dist/'
        }]})
    ]
}